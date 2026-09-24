import { cancelShipment, findShipmentIdByTrackingNumber } from "../../lib/skydropx";
import {
  getManualShipmentRequest,
  acquireShipmentGenerationLock,
  releaseShipmentGenerationLock,
} from "../../lib/manualShipments";
import { getManufacturerOrder, markManufacturerOrderCancelled } from "../../lib/manufacturerFinance";
import { sendGuideCancelledEmail, cancelScheduledEmail, sendGuideCorrectionEmail } from "../../lib/email";
import { getFabricantesByAccessCode } from "../../lib/fabricantes";

// Botón "Cancelar guía" de /fabricante. Mismo código de acceso que
// /api/fabricante-status (sin ADMIN_PASSWORD) — ver app/fabricante/page.js.
// El código identifica a qué fabricante pertenece el pedido: nunca se
// confía en un fabricanteId suelto del cliente, siempre se revalida acá.
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

  const fabricantes = getFabricantesByAccessCode(code);
  if (fabricantes.length === 0) {
    return Response.json({ error: "Código incorrecto" }, { status: 401 });
  }
  if (!reference) {
    return Response.json({ error: "Falta la referencia del pedido" }, { status: 400 });
  }
  if (!reason || !reason.trim()) {
    return Response.json({ error: "El motivo es obligatorio" }, { status: 400 });
  }

  // Ver comentario equivalente en fabricante-generate-shipment/route.js.
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
  if (order.status === "cancelado") {
    return Response.json({ error: "Esa guía ya está cancelada" }, { status: 400 });
  }

  // Mismo candado que la generación de guía (ver
  // acquireShipmentGenerationLock): con doble clic, dos cancelaciones
  // simultáneas le restarían DOS veces la comisión al fabricante.
  if (!(await acquireShipmentGenerationLock(reference))) {
    return Response.json(
      { error: "Ya se está procesando un cambio en la guía de este pedido. Espera un minuto y recarga la página." },
      { status: 409 }
    );
  }
  try {
    const fresh = await getManufacturerOrder(fabricante.id, reference);
    if (!fresh || fresh.status === "cancelado") {
      return Response.json({ error: "Esa guía ya está cancelada" }, { status: 400 });
    }
    return await cancelLocked({ fabricante, order: fresh, reference, reason });
  } finally {
    await releaseShipmentGenerationLock(reference);
  }
}

async function cancelLocked({ fabricante, order, reference, reason }) {
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
      // Se incluye el motivo real de Skydropx (ej. la guía ya fue
      // escaneada por la transportadora y no admite cancelación) para que
      // el fabricante sepa si reintentar sirve o hay que avisar a Mystery.
      { error: `No se pudo cancelar la guía en Skydropx. ${err.message || ""}`.trim() },
      { status: 502 }
    );
  }

  const updated = await markManufacturerOrderCancelled({
    fabricanteId: fabricante.id,
    reference,
    reason: reason.trim(),
  });
  if (!updated) {
    console.error(
      `[fabricante-cancel-shipment] La guía se canceló en Skydropx pero no se pudo actualizar Redis para reference=${reference}`
    );
  }

  // Blindaje frente al correo "va en camino" ya programado (ver
  // app/lib/email.js) — la ventana real es de 2 horas desde que se generó
  // la guía (sendShippingNotificationEmail se programa con scheduledAt:
  // "in 2 hours", ver app/api/generate-shipment/route.js), así que ESO
  // es lo que decide qué hacer, no la respuesta de cancelScheduledEmail:
  //   - Todavía no pasaron 2 horas: el correo NO pudo haber salido
  //     todavía. Solo se cancela el programado (para que nunca salga) y
  //     listo — nunca hay que mandar corrección, porque el cliente nunca
  //     llegó a ver un número de guía.
  //   - Ya pasaron 2 horas: Resend ya debió haberlo disparado (o está a
  //     punto), así que no tiene sentido intentar cancelarlo — se asume
  //     enviado directamente y se manda la corrección, sin mencionar
  //     "cancelación" para no alarmar, solo avisando que el pedido sigue
  //     en proceso.
  // Nunca debe tumbar la respuesta de éxito: la guía ya está cancelada en
  // Skydropx y el registro ya quedó actualizado, que es lo que importa
  // para el fabricante.
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const generatedAtMs = manualRecord?.generatedAt ? new Date(manualRecord.generatedAt).getTime() : null;
  // Sin generatedAt (no debería pasar para una guía con guideUrl) se
  // asume lo más conservador: que ya se envió, para no arriesgarse a
  // dejar al cliente sin avisar.
  const alreadySent = generatedAtMs === null || Date.now() - generatedAtMs >= TWO_HOURS_MS;

  if (manualRecord?.customer?.email) {
    try {
      if (alreadySent) {
        await sendGuideCorrectionEmail({ customer: manualRecord.customer });
      } else {
        await cancelScheduledEmail(manualRecord.scheduledEmailId);
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
