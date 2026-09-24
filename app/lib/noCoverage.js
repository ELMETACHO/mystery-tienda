import { markManualShipmentNoCoverage } from "./manualShipments";
import { sendNoCoverageCustomerEmail, sendNoCoverageAdminEmail } from "./email";

// El envío a la dirección del cliente supera el tope de costo (ver
// MAX_SHIPPING_COST_COP en app/lib/skydropx.js): no se genera guía, se
// marca el pedido como "no_coverage" y se avisa al cliente (no enviamos a
// su ciudad, devolución programada) y a Oscar (datos para devolver el
// dinero a mano). Usado por los dos botones de generar guía
// (app/api/generate-shipment y app/api/fabricante-generate-shipment).
//
// Idempotente: los correos salen SOLO la primera vez (ver
// markManualShipmentNoCoverage). Nunca lanza.
export async function handleNoCoverage({ reference, record, error }) {
  const first = await markManualShipmentNoCoverage(reference, {
    shippingCostCOP: error.shippingCostCOP,
    carrierName: error.carrierName,
  });
  if (!first) return;

  // Contraentrega: solo pagó el anticipo (precio - saldo pendiente).
  // Pago completo por Wompi: saldoPendiente es 0, pagó el precio completo.
  const amountPaidCOP = Math.max(0, (record.order?.priceCOP || 0) - (record.saldoPendiente || 0));

  try {
    if (record.customer?.email) {
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
    });
  } catch (err) {
    console.error("[noCoverage] Falló el aviso de devolución a Mystery:", err);
  }
}
