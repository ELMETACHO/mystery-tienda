import { getAllPendingOrders, markCartRecoveryEmailSent } from "../../../lib/pendingOrders";
import { getCompletedOrderByReference } from "../../../lib/completedOrders";
import { generateCartRecoveryToken } from "../../../lib/cartRecoveryToken";
import { sendCartRecoveryEmail } from "../../../lib/email";
import { claimCartRecoveryEmail, releaseCartRecoveryEmailClaim } from "../../../lib/idempotency";

// Disparado por Vercel Cron cada hora (ver vercel.json) — mismo criterio
// de autenticación que /api/cron/send-review-emails: solo Vercel conoce
// CRON_SECRET, así nadie externo puede disparar el envío masivo llamando
// la ruta directamente.
function isAuthorizedCronRequest(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// "Más de 1-2 horas sin convertirse en pedido confirmado" — con el cron
// corriendo cada hora, un pending-order que recién cumple 1h se agarra
// en la siguiente corrida (hasta ~2h de esperado), que es justo el rango
// pedido, sin necesitar dos umbrales distintos.
const ONE_HOUR_MS = 60 * 60 * 1000;

export async function GET(request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const pendingOrders = await getAllPendingOrders();
  const now = Date.now();

  const dueOrders = [];
  for (const pending of pendingOrders) {
    if (pending.cartRecoveryEmailSentAt) continue;
    if (!pending.customer?.email || !pending.order?.croppedImage) continue;

    const createdAt = new Date(pending.createdAt || 0).getTime();
    if (!createdAt || now - createdAt < ONE_HOUR_MS) continue;

    // Si ya existe un pedido confirmado con la misma reference, no es un
    // carrito abandonado — el cliente sí pagó, el pending-order solo no
    // se limpió (nunca se borra, expira solo por TTL, ver
    // pendingOrders.js). Se omite para no mandar un correo confuso a
    // alguien que ya recibió su cuadro en camino.
    // eslint-disable-next-line no-await-in-loop
    const completed = await getCompletedOrderByReference(pending.reference);
    if (completed) continue;

    dueOrders.push(pending);
  }

  let sent = 0;
  let failed = 0;

  // Secuencial a propósito — mismo criterio conservador que
  // send-review-emails: pocos correos por corrida, sin ráfagas
  // simultáneas contra Resend.
  for (const pending of dueOrders) {
    const claimed = await claimCartRecoveryEmail(pending.reference);
    if (!claimed) {
      console.error(
        `[cron/send-cart-recovery-emails] reference=${pending.reference} ya está siendo procesada por otra corrida — se omite.`
      );
      continue;
    }

    try {
      const token = generateCartRecoveryToken(pending.reference);
      await sendCartRecoveryEmail({
        order: pending.order,
        customer: pending.customer,
        reference: pending.reference,
        token,
      });
      await markCartRecoveryEmailSent(pending.reference);
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error(
        `[cron/send-cart-recovery-emails] Falló el envío para reference=${pending.reference}:`,
        err
      );
      // Se libera el reclamo para que la corrida de la próxima hora
      // pueda reintentarlo.
      await releaseCartRecoveryEmailClaim(pending.reference);
    }
  }

  return Response.json({
    ok: true,
    checked: pendingOrders.length,
    due: dueOrders.length,
    sent,
    failed,
  });
}
