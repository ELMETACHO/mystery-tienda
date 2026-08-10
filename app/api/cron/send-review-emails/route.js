import { getCompletedOrders, markReviewEmailSent } from "../../../lib/completedOrders";
import { generateReviewToken } from "../../../lib/reviewToken";
import { sendReviewRequestEmail } from "../../../lib/email";

// Disparado una vez al día por Vercel Cron (ver vercel.json, 13:00 UTC
// = 8:00am Colombia). Vercel firma sus propias llamadas de cron con
// "Authorization: Bearer <CRON_SECRET>" — cualquier otra petición a
// esta URL (sin ese header exacto) se rechaza, para que nadie externo
// pueda disparar el envío masivo llamando la ruta directamente.
function isAuthorizedCronRequest(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export async function GET(request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const orders = await getCompletedOrders();
  const now = Date.now();

  const dueOrders = orders.filter((order) => {
    if (order.reviewEmailSentAt) return false;
    const purchasedAt = new Date(order.purchasedAt).getTime();
    return now - purchasedAt >= FIVE_DAYS_MS;
  });

  let sent = 0;
  let failed = 0;

  // Secuencial (no Promise.all) a propósito: son pocos correos por
  // corrida y así un fallo puntual con Resend no dispara ráfagas de
  // requests simultáneas — mismo criterio conservador que el resto de
  // los endpoints de confirmación de pago.
  for (const order of dueOrders) {
    try {
      const token = generateReviewToken(order.reference);
      await sendReviewRequestEmail({ order, token });
      await markReviewEmailSent(order.reference);
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error(
        `[cron/send-review-emails] Falló el envío para reference=${order.reference}:`,
        err
      );
      // No se marca reviewEmailSentAt: la corrida de mañana lo vuelve
      // a intentar. Nunca lanza — un pedido con error no debe frenar
      // el envío al resto de la lista.
    }
  }

  return Response.json({ ok: true, checked: orders.length, due: dueOrders.length, sent, failed });
}
