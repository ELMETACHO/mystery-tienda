import { getAllPendingOrders, markCartRecoveryEmailSent } from "../../../lib/pendingOrders";
import { getCompletedOrderByReference } from "../../../lib/completedOrders";
import { generateCartRecoveryToken } from "../../../lib/cartRecoveryToken";
import { sendCartRecoveryEmail } from "../../../lib/email";
import { fetchWompiTransactionsByReference } from "../../../lib/wompi";
import { confirmApprovedOrder } from "../../../lib/confirmApprovedOrder";
import { confirmApprovedCodOrder } from "../../../lib/confirmApprovedCodOrder";
import { claimCartRecoveryEmail, releaseCartRecoveryEmailClaim } from "../../../lib/idempotency";

// Vercel Hobby (el plan actual) solo permite cron jobs nativos de una
// vez al día — no alcanza para el timing de 1-2h que necesita la
// recuperación de carrito. Por eso esta ruta NO está en vercel.json (a
// diferencia de send-review-emails, que sí puede ser diario/nativo): en
// su lugar, un cron externo (cron-job.org) llama este endpoint cada
// hora desde afuera de Vercel. Misma protección de todas formas: solo
// quien conoce CRON_SECRET (configurado como header Authorization en
// cron-job.org) puede disparar el envío masivo.
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

  // Conciliación: un pedido "pendiente" cuyo pago SÍ fue aprobado en Wompi
  // es un pago real que no se confirmó (ni por el navegador del cliente ni
  // por el webhook) — se confirma acá con los datos guardados. Es
  // idempotente (claimTransaction), así que no duplica nada si otro camino
  // ya lo procesó. Nunca se le manda correo de "carrito abandonado" a
  // alguien que ya pagó.
  const reconciled = new Set();
  for (const pending of pendingOrders) {
    const createdAt = new Date(pending.createdAt || 0).getTime();
    if (!createdAt || now - createdAt < 5 * 60 * 1000) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      if (await getCompletedOrderByReference(pending.reference)) continue;
      // eslint-disable-next-line no-await-in-loop
      const txs = await fetchWompiTransactionsByReference(pending.reference);
      const approved = txs.find((t) => t.status === "APPROVED");
      if (!approved) continue;

      const confirmFn = pending.paymentMethod === "cod" ? confirmApprovedCodOrder : confirmApprovedOrder;
      // eslint-disable-next-line no-await-in-loop
      const result = await confirmFn({ order: pending.order, customer: pending.customer, transaction: approved });
      reconciled.add(pending.reference);
      console.error(
        `[cron/reconcile] Pago aprobado sin confirmar RECUPERADO: reference=${pending.reference} alreadyProcessed=${Boolean(result?.alreadyProcessed)}`
      );
    } catch (err) {
      console.error(`[cron/reconcile] Falló la conciliación de reference=${pending.reference}:`, err);
    }
  }

  const dueOrders = [];
  for (const pending of pendingOrders) {
    if (reconciled.has(pending.reference)) continue;
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
    reconciled: reconciled.size,
    due: dueOrders.length,
    sent,
    failed,
  });
}
