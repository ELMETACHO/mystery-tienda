import { markManualShipmentNoCoverage } from "./manualShipments";
import { sendNoCoverageCustomerEmail, sendNoCoverageAdminEmail } from "./email";
import { quoteCheapestShipping } from "./skydropx";

// El envío a la dirección del cliente supera el tope de costo (ver
// MAX_SHIPPING_COST_COP en app/lib/skydropx.js): no se genera guía, se
// marca el pedido como "no_coverage" y se avisa al cliente (no enviamos a
// su ciudad, devolución programada) y a Mystery (datos para devolver el
// dinero a mano).
//
// Se detecta en dos momentos:
//   - stage "payment": apenas se confirma el pago, en segundo plano (ver
//     checkShippingCoverageAfterPayment) — el fabricante nunca recibe el
//     pedido, así que no se fabrica nada.
//   - stage "guide": al generar la guía (red de seguridad, si la
//     cotización tras el pago falló) — el cuadro ya puede estar fabricado.
//
// Idempotente: los correos salen SOLO la primera vez (ver
// markManualShipmentNoCoverage). Nunca lanza.
export async function handleNoCoverage({ reference, record, error, stage = "guide" }) {
  const first = await markManualShipmentNoCoverage(reference, {
    shippingCostCOP: error.shippingCostCOP,
    carrierName: error.carrierName,
  });
  if (!first) return;

  // Contraentrega: solo pagó el anticipo (precio - saldo pendiente).
  // Pago completo por Wompi: saldoPendiente es 0, pagó el precio completo.
  // Regalo: $0, no hay nada que devolver.
  const amountPaidCOP =
    record.paymentMethod === "regalo"
      ? 0
      : Math.max(0, (record.order?.priceCOP || 0) - (record.saldoPendiente || 0));

  try {
    if (record.customer?.email && amountPaidCOP > 0) {
      await sendNoCoverageCustomerEmail({ customer: record.customer });
    }
  } catch (err) {
    console.error("[noCoverage] Falló el correo al cliente:", err);
  }

  try {
    await sendNoCoverageAdminEmail({
      reference,
      customer: record.customer,
      paymentMethod: record.paymentMethod,
      amountPaidCOP,
      shippingCostCOP: error.shippingCostCOP,
      carrierName: error.carrierName,
      stage,
    });
  } catch (err) {
    console.error("[noCoverage] Falló el aviso de devolución a Mystery:", err);
  }
}

// Cotiza el envío apenas se confirma el pago (en segundo plano, dentro de
// after() — el cliente nunca espera ni ve nada de esto). Devuelve false
// SOLO cuando la cotización confirmó que el envío supera el tope: en ese
// caso ya se manejó la devolución y el llamador NO debe mandar el pedido
// al fabricante. Cualquier otra cosa (cubre, la cotización falló,
// Skydropx caído) devuelve true y el pedido sigue exactamente igual que
// siempre. Nunca lanza.
export async function checkShippingCoverageAfterPayment({
  reference,
  order,
  customer,
  paymentMethod,
  saldoPendiente,
}) {
  let quote = null;
  try {
    quote = await quoteCheapestShipping({
      order,
      customer,
      isCod: paymentMethod === "cod",
      codAmountCOP: saldoPendiente,
    });
  } catch (err) {
    console.error(`[noCoverage] No se pudo cotizar el envío tras el pago (${reference}):`, err);
    return true;
  }
  if (!quote || !quote.exceedsCap) return true;

  await handleNoCoverage({
    reference,
    record: { order, customer, paymentMethod, saldoPendiente },
    error: { shippingCostCOP: quote.costCOP, carrierName: quote.carrierName },
    stage: "payment",
  });
  return false;
}
