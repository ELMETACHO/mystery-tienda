import { getCompletedOrders, markReviewEmailSent } from "../../../lib/completedOrders";
import { generateReviewToken } from "../../../lib/reviewToken";
import { sendReviewRequestEmail, sendDateReminderEmail } from "../../../lib/email";
import {
  OCCASIONS,
  dueOccurrence,
  getAllDateReminders,
  markDateReminderSent,
  generateReminderCancelToken,
} from "../../../lib/dateReminders";
import { claimReviewEmail, releaseReviewEmailClaim } from "../../../lib/idempotency";

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

// 8 días desde la compra (antes 5, oct 2026): el cuadro llega en máximo
// 5 días sin contar domingos, así que a los 5 días a veces todavía no había
// llegado. Se recomienda pedir la reseña unos días DESPUÉS de la entrega.
const REVIEW_DELAY_MS = 8 * 24 * 60 * 60 * 1000;

export async function GET(request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const orders = await getCompletedOrders();
  const now = Date.now();

  const dueOrders = orders.filter((order) => {
    if (order.reviewEmailSentAt) return false;
    const purchasedAt = new Date(order.purchasedAt).getTime();
    return now - purchasedAt >= REVIEW_DELAY_MS;
  });

  let sent = 0;
  let failed = 0;

  // Secuencial (no Promise.all) a propósito: son pocos correos por
  // corrida y así un fallo puntual con Resend no dispara ráfagas de
  // requests simultáneas — mismo criterio conservador que el resto de
  // los endpoints de confirmación de pago.
  for (const order of dueOrders) {
    // Reclamo de idempotencia ANTES de enviar nada: si dos corridas de
    // esta ruta se solapan (o el mismo request llega duplicado), solo
    // una de las dos gana el reclamo — la otra ve `false` y no manda
    // el correo. Sin esto, ambas podían leer reviewEmailSentAt: null
    // (todavía no se había marcado) y enviar el correo por separado.
    const claimed = await claimReviewEmail(order.reference);
    if (!claimed) {
      console.error(
        `[cron/send-review-emails] reference=${order.reference} ya está siendo procesada por otra corrida — se omite.`
      );
      continue;
    }

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
      // Se libera el reclamo (no reviewEmailSentAt, que sigue sin
      // marcarse) para que la corrida de mañana pueda reintentarlo.
      await releaseReviewEmailClaim(order.reference);
    }
  }

  const reminders = await sendDueDateReminders(orders);

  return Response.json({ ok: true, checked: orders.length, due: dueOrders.length, sent, failed, reminders });
}

// Recordatorios de fecha especial (app/lib/dateReminders.js). Van en este
// mismo cron diario porque Vercel Hobby limita los cron nativos. El correo
// de destino sale del pedido real (completed-orders), nunca del registro
// del recordatorio: una referencia que no corresponde a un pedido pagado
// no envía nada. Se marca como enviado ANTES de mandar (una sola vez por
// ocurrencia, aunque dos corridas se solapen o Resend falle: preferimos
// perder un recordatorio a mandarlo dos veces).
async function sendDueDateReminders(orders) {
  const byReference = new Map(orders.map((o) => [o.reference, o]));
  let sent = 0;
  let failed = 0;

  for (const reminder of await getAllDateReminders()) {
    const occurrence = dueOccurrence(reminder);
    if (!occurrence) continue;
    const order = byReference.get(reminder.reference);
    if (!order?.customerEmail) continue;

    if (!(await markDateReminderSent(reminder.reference, occurrence))) continue;
    try {
      await sendDateReminderEmail({
        to: order.customerEmail,
        customerName: order.customerName,
        occasionLabel: OCCASIONS[reminder.occasion] || OCCASIONS.otra,
        forName: reminder.forName,
        occurrence,
        reference: reminder.reference,
        cancelToken: generateReminderCancelToken(reminder.reference),
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error(`[cron/date-reminders] Falló el envío para reference=${reminder.reference}:`, err);
    }
  }

  return { sent, failed };
}
