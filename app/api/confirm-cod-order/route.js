import { fetchWompiTransaction } from "../../lib/wompi";
import { sendOrderEmails } from "../../lib/email";
import { recordOrderAndCheckReturning } from "../../lib/loyalty";
import { COD_DEPOSIT_COP } from "../../lib/order";
import { saveManualShipmentRequest } from "../../lib/manualShipments";
import { processCatalogProductPurchase } from "../../lib/catalogPurchase";
import { grantDiscountCode, markDiscountUsed } from "../../lib/discount";
import { recordReferralSale } from "../../lib/referrals";

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

  const anticipoPagado = COD_DEPOSIT_COP;
  const saldoPendiente = order.priceCOP - COD_DEPOSIT_COP;

  // Nunca lanza (ver manualShipments.js) — si esto falla, el pedido sigue
  // su curso igual; el único efecto es que el botón del correo del
  // fabricante no podrá generar la guía más adelante (se loguea fuerte
  // ahí mismo para detectarlo).
  await saveManualShipmentRequest({
    reference: transaction.reference,
    order,
    customer,
    paymentMethod: "cod",
    saldoPendiente,
  });

  const isReturningCustomer = await recordOrderAndCheckReturning({
    email: customer.email,
    reference: transaction.reference,
    amountCOP: order.priceCOP,
  });

  // Mismo patrón que /api/confirm-order (ver confirmApprovedOrder.js):
  // otorgar el código no reemplaza uno ya existente, y marcarlo usado
  // revalida code/used contra el registro real en Redis.
  if (isReturningCustomer) {
    await grantDiscountCode(customer.email);
  }
  if (order.discountCode) {
    await markDiscountUsed(customer.email, order.discountCode);
  }

  // Mismo punto que el descuento: si el pedido trae un código de
  // referido, acredita la comisión según el tamaño comprado — nunca
  // bloquea la confirmación si el código no existe o Redis falla.
  if (order.referralCode) {
    await recordReferralSale({ code: order.referralCode, sizeId: order.sizeId });
  }

  // Si el pedido viene de /producto/[id] (catálogo), incrementa el
  // contador de ventas de ese producto y trae el archivo real de
  // "Original (Portafolio)" desde Drive para adjuntarlo — no hace nada
  // para pedidos normales de /crear (sin order.productId).
  const { printImageBase64 } = await processCatalogProductPurchase(order);

  try {
    await sendOrderEmails({
      order,
      customer,
      transaction,
      isReturningCustomer,
      paymentMethod: "cod",
      anticipoPagado,
      saldoPendiente,
      printImageBase64Override: printImageBase64,
    });
  } catch (err) {
    console.error("[confirm-cod-order] Falló el envío de correos:", err);
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
