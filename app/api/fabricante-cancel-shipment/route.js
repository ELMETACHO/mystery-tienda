import { cancelShipment, findShipmentIdByTrackingNumber } from "../../lib/skydropx";
import { getManualShipmentRequest } from "../../lib/manualShipments";
import { getManufacturerOrder, markManufacturerOrderCancelled } from "../../lib/manufacturerFinance";
import { sendGuideCancelledEmail, cancelScheduledEmail, sendGuideCorrectionEmail } from "../../lib/email";

function isAuthenticated(code) {
  const expected = process.env.FABRICANTE_ACCESS_CODE;
  return Boolean(expected) && code === expected;
}

// Botón "Cancelar guía" de /fabricante. Mismo código de acceso que
// /api/fabricante-status (sin ADMIN_PASSWORD) — ver app/fabricante/page.js.
//
// Resuelve el shipmentId de Skydropx en dos pasos: primero el que ya
// guardamos junto al pedido (ver recordManufacturerOrder, solo presente
// en guías generadas DESPUÉS de agregar este campo); si no está, cae al
// trackingNumber guardado en manual-shipment:{reference} (ese sí existía
// desde antes) y usa findShipmentIdByTrackingNumber para encontrarlo
// escaneando la cuenta de Skydropx (no hay filtro confiable por
// order_number/tracking_number en su API — confirmado probando en vivo).
export async function POST(request) {
  const { code, reference, reason } = await request.json().catch(() => ({}));

  if (!isAuthenticated(code)) {
    return Response.json({ error: "Código incorrecto" }, { status: 401 });
  }
  if (!reference) {
    return Response.json({ error: "Falta la referencia del pedido" }, { status: 400 });
  }
  if (!reason || !reason.trim()) {
    return Response.json({ error: "El motivo es obligatorio" }, { status: 400 });
  }

  const order = await getManufacturerOrder(reference);
  if (!order) {
    return Response.json({ error: "No se encontró ese pedido" }, { status: 404 });
  }
  if (order.status === "cancelado") {
    return Response.json({ error: "Esa guía ya está cancelada" }, { status: 400 });
  }

  // Se necesita de todos modos (customer real con email, y
  // scheduledEmailId del aviso "va en camino" ya programado) además de
  // como fallback para el trackingNumber cuando falta shipmentId.
  const manualRecord = await getManualShipmentRequest(reference);

  let shipmentId = order.shipmentId || null;
  if (!shipmentId) {
    const trackingNumber = order.trackingNumber || manualRecord?.trackingNumber || null;
    shipmentId = await findShipmentIdByTrackingNumber(trackingNumber);
  }

  if (!shipmentId) {
    return Response.json(
      {
        error:
          "No pudimos encontrar la guía en Skydropx para cancelarla automáticamente. Cancélala manualmente desde el panel de Skydropx y avisa a Mystery.",
      },
      { status: 502 }
    );
  }

  try {
    await cancelShipment(shipmentId, { reason: reason.trim() });
  } catch (err) {
    console.error("[fabricante-cancel-shipment] Falló la cancelación en Skydropx:", err);
    return Response.json(
      { error: "No se pudo cancelar la guía en Skydropx. Intenta de nuevo." },
      { status: 502 }
    );
  }

  const updated = await markManufacturerOrderCancelled({ reference, reason: reason.trim() });
  if (!updated) {
    console.error(
      `[fabricante-cancel-shipment] La guía se canceló en Skydropx pero no se pudo actualizar Redis para reference=${reference}`
    );
  }

  // Blindaje frente al correo "va en camino" ya programado (ver
  // app/lib/email.js): si todavía no ha salido, se cancela y el cliente
  // nunca lo ve. Si Resend ya lo envió (o el id no existe/venció), en vez
  // de dejar al cliente con un número de guía que ya no sirve, se manda
  // un correo de corrección — sin mencionar "cancelación" para no
  // alarmar, solo avisando que el pedido sigue en proceso. Nunca debe
  // tumbar la respuesta de éxito: la guía ya está cancelada en Skydropx y
  // el registro ya quedó actualizado, que es lo que importa para el
  // fabricante.
  if (manualRecord?.customer?.email) {
    try {
      const { cancelled } = await cancelScheduledEmail(manualRecord.scheduledEmailId);
      if (!cancelled) {
        await sendGuideCorrectionEmail({ customer: manualRecord.customer });
      }
    } catch (err) {
      console.error(
        "[fabricante-cancel-shipment] Falló el blindaje del correo 'va en camino':",
        err
      );
    }
  }

  // Nunca debe tumbar la respuesta de éxito — la guía ya está cancelada
  // en Skydropx y el registro ya quedó actualizado, que es lo que importa
  // para el fabricante; el correo es solo un aviso adicional al admin.
  try {
    await sendGuideCancelledEmail({
      order,
      customer: { fullName: order.cliente, city: order.ciudad },
      reference,
      reason: reason.trim(),
      trackingNumber: order.trackingNumber,
      carrierName: order.carrierName,
    });
  } catch (err) {
    console.error("[fabricante-cancel-shipment] Falló el correo de aviso al admin:", err);
  }

  return Response.json({ ok: true, order: updated || order });
}
