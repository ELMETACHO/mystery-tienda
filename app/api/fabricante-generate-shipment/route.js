import { createManualShipment } from "../../lib/skydropx";
import {
  getManualShipmentRequest,
  markManualShipmentGenerated,
  saveScheduledEmailId,
} from "../../lib/manualShipments";
import { getManufacturerOrder, markManufacturerOrderRegenerated } from "../../lib/manufacturerFinance";
import { sendShippingNotificationEmail } from "../../lib/email";
import { getFabricantesByAccessCode } from "../../lib/fabricantes";

// Botón "Generar guía nueva" de /fabricante — SOLO para pedidos que están
// en estado "cancelado" (ver markManufacturerOrderCancelled). Reutiliza
// createManualShipment() con los mismos order/customer que ya se
// guardaron en manual-shipment:{reference} al confirmar el pago original
// (ver app/lib/manualShipments.js) — nunca le pide esos datos de nuevo al
// fabricante, ya los tenemos.
export async function POST(request) {
  const { code, reference } = await request.json().catch(() => ({}));

  const fabricantes = getFabricantesByAccessCode(code);
  if (fabricantes.length === 0) {
    return Response.json({ error: "Código incorrecto" }, { status: 401 });
  }
  if (!reference) {
    return Response.json({ error: "Falta la referencia del pedido" }, { status: 400 });
  }

  // Con el código compartido de Cristhian, el pedido puede estar en
  // cualquiera de sus fabricantes habilitados (Premium o Tradicional) —
  // se prueba cada uno hasta encontrarlo.
  let fabricante = null;
  let order = null;
  for (const candidate of fabricantes) {
    const found = await getManufacturerOrder(candidate.id, reference);
    if (found) {
      fabricante = candidate;
      order = found;
      break;
    }
  }
  if (!order) {
    return Response.json({ error: "No se encontró ese pedido" }, { status: 404 });
  }
  if (order.status !== "cancelado") {
    return Response.json(
      { error: "Solo se puede generar una guía nueva para pedidos con la guía cancelada" },
      { status: 400 }
    );
  }

  const manualRecord = await getManualShipmentRequest(reference);
  if (!manualRecord) {
    return Response.json(
      { error: "Ya no tenemos los datos guardados de este pedido (venció a los 30 días)." },
      { status: 404 }
    );
  }

  let shipment;
  try {
    shipment = await createManualShipment({
      order: manualRecord.order,
      customer: manualRecord.customer,
      reference,
      isCod: manualRecord.paymentMethod === "cod",
      // Ver skydropx.js (getCodAmount): declara/cobra el SALDO pendiente,
      // no el precio total otra vez.
      codAmountCOP: manualRecord.saldoPendiente,
    });
  } catch (err) {
    console.error("[fabricante-generate-shipment] Falló la creación de guía en Skydropx:", err);
    return Response.json(
      { error: err.message || "No se pudo generar la guía en Skydropx." },
      { status: 502 }
    );
  }

  if (!shipment.trackingNumber) {
    return Response.json(
      { error: "Skydropx no devolvió un número de guía tras reintentar." },
      { status: 502 }
    );
  }

  await markManualShipmentGenerated(reference, {
    shipmentId: shipment.shipmentId,
    trackingNumber: shipment.trackingNumber,
    carrierName: shipment.carrierName,
    labelUrl: shipment.labelUrl,
    trackingUrl: shipment.trackingUrl,
  });

  const updated = await markManufacturerOrderRegenerated({
    fabricanteId: fabricante.id,
    reference,
    guideUrl: shipment.labelUrl,
    shipmentId: shipment.shipmentId,
    trackingNumber: shipment.trackingNumber,
    carrierName: shipment.carrierName,
    shippingCostCOP: shipment.shippingCostCOP,
  });

  // Aviso al cliente de la guía NUEVA — mismo patrón que
  // app/api/generate-shipment/route.js (2 horas de margen, guardando el
  // id para poder cancelarlo si esta guía también se llega a cancelar).
  // Nunca debe tumbar la respuesta de éxito: la guía ya se generó y se
  // guardó igual.
  try {
    const scheduledEmailId = await sendShippingNotificationEmail({
      customer: manualRecord.customer,
      trackingNumber: shipment.trackingNumber,
      carrierName: shipment.carrierName,
      trackingUrl: shipment.trackingUrl,
      labelUrl: shipment.labelUrl,
      saldoPendiente: manualRecord.saldoPendiente,
      scheduledAt: "in 2 hours",
    });
    await saveScheduledEmailId(reference, scheduledEmailId);
  } catch (emailErr) {
    console.error("[fabricante-generate-shipment] Falló el correo de guía nueva:", emailErr);
  }

  return Response.json({ ok: true, order: updated || order });
}
