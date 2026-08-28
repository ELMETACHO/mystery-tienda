import { fetchWompiTransaction } from "../../lib/wompi";
import { confirmApprovedCodOrder } from "../../lib/confirmApprovedCodOrder";
import { checkRateLimit, rateLimitResponse } from "../../lib/rateLimit";

// Confirma un pedido "Pago contraentrega": el cliente paga un anticipo
// fijo (COD_DEPOSIT_COP) por Wompi para cubrir costos de producción, y el
// saldo restante lo paga en efectivo al recibir el cuadro. A diferencia
// de /api/confirm-order (pago completo), acá SÍ hay una transacción de
// Wompi que verificar, pero solo por el monto del anticipo — nunca se
// confía en el navegador para eso.
//
// La guía de Skydropx YA NO se genera automáticamente acá (se probó y
// funcionaba, pero arriesgaba que la guía venciera esperando días a que
// se produjera el cuadro — pasó con la guía real de Alvaro Ríos Piña).
// En vez de eso, se guarda la solicitud completa en Redis
// (manualShipments.js, TTL 30 días) y el correo al fabricante
// (sendOrderEmails) incluye un botón "✅ Ya está listo — generar guía
// ahora" que dispara /api/generate-shipment cuando el cuadro esté
// realmente listo para despachar.
export async function POST(request) {
  const { limited, retryAfter } = await checkRateLimit(request, "confirm-cod-order");
  if (limited) return rateLimitResponse(retryAfter);

  const { transactionId, order, customer } = await request.json();

  if (!transactionId || !order || !customer) {
    return Response.json({ error: "Datos incompletos" }, { status: 400 });
  }

  let transaction;
  try {
    transaction = await fetchWompiTransaction(transactionId);
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: "No se pudo verificar el pago del anticipo con Wompi" },
      { status: 502 }
    );
  }

  if (transaction.status !== "APPROVED") {
    return Response.json(
      { error: "El anticipo no está aprobado", status: transaction.status },
      { status: 402 }
    );
  }

  // confirmApprovedCodOrder es idempotente (mismo lock que
  // confirmApprovedOrder.js) — si el webhook (/api/wompi-webhook) ya
  // confirmó esta misma transacción antes de que el cliente regresara a
  // esta pestaña, acá simplemente no se repite el trabajo ni los correos.
  let isReturningCustomer, anticipoPagado, saldoPendiente;
  try {
    ({ isReturningCustomer, anticipoPagado, saldoPendiente } = await confirmApprovedCodOrder({
      order,
      customer,
      transaction,
    }));
  } catch (err) {
    console.error("[confirm-cod-order] Falló la confirmación:", err);
    return Response.json(
      { error: "El anticipo se confirmó pero falló el envío de correos" },
      { status: 500 }
    );
  }

  return Response.json({
    verified: true,
    reference: transaction.reference,
    status: transaction.status,
    isReturningCustomer,
    anticipoPagado,
    saldoPendiente,
  });
}
