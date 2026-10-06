import { createManualShipment } from "../../lib/skydropx";
import {
  getManualShipmentRequest,
  markManualShipmentGenerated,
  saveScheduledEmailId,
  acquireShipmentGenerationLock,
  releaseShipmentGenerationLock,
  savePendingShipmentId,
} from "../../lib/manualShipments";
import { getManufacturerOrder, markManufacturerOrderRegenerated } from "../../lib/manufacturerFinance";
import { sendShippingNotificationEmail, sendExtraProtectionEmail } from "../../lib/email";
import { getFabricantesByAccessCode } from "../../lib/fabricantes";
import { handleNoCoverage } from "../../lib/noCoverage";
import { isBlockedByFailedAttempts, registerFailedAttempt, rateLimitResponse } from "../../lib/rateLimit";
// La cotización espera a que TODAS las transportadoras respondan (hasta
// 40s, ver pollQuotationRates en app/lib/skydropx.js) y luego se espera el
// número de la guía (hasta ~40s más) — margen para que Vercel no corte a
// mitad. (Antes de oct 2026 esta línea quedó pegada dentro de un
// comentario por error y nunca aplicó.)
export const maxDuration = 120;

// Botón "Generar guía nueva" de /fabricante — SOLO para pedidos que están
// en estado "cancelado" (ver markManufacturerOrderCancelled). Reutiliza
// createManualShipment() con los mismos order/customer que ya se
// guardaron en manual-shipment:{reference} al confirmar el pago original
// (ver app/lib/manualShipments.js) — nunca le pide esos datos de nuevo al
// fabricante, ya los tenemos.
export async function POST(request) {
  const { blocked, retryAfter } = await isBlockedByFailedAttempts(request, "fabricante-code", { limit: 10 });
  if (blocked) return rateLimitResponse(retryAfter);

  const { code, reference } = await request.json().catch(() => ({}));

  const fabricantes = getFabricantesByAccessCode(code);
  if (fabricantes.length === 0) {
    await registerFailedAttempt(request, "fabricante-code");
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

  // Candado contra el doble clic (ver acquireShipmentGenerationLock): solo
  // una petición a la vez genera la guía de este pedido. Se mantiene hasta
  // que el pedido vuelve a quedar "activo", y se relee el estado después de
  // tomarlo por si otra petición ya lo regeneró mientras tanto.
  if (!(await acquireShipmentGenerationLock(reference))) {
    return Response.json(
      { error: "La guía de este pedido ya se está generando. Espera un minuto y recarga la página." },
      { status: 409 }
    );
  }
  try {
    return await generateLocked({ fabricante, reference, manualRecord });
  } finally {
    await releaseShipmentGenerationLock(reference);
  }
}

async function generateLocked({ fabricante, reference, manualRecord }) {
  const order = await getManufacturerOrder(fabricante.id, reference);
  if (!order || order.status !== "cancelado") {
    return Response.json(
      { error: "Este pedido ya tiene una guía nueva. Recarga la página." },
      { status: 409 }
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
      // Ver app/api/generate-shipment/route.js: retoma la guía que un
      // intento anterior ya creó en vez de crear (y pagar) otra.
      existingShipmentId: (await getManualShipmentRequest(reference))?.pendingShipmentId || null,
      onShipmentAccepted: (shipmentId) => savePendingShipmentId(reference, shipmentId),
    });
  } catch (err) {
    if (err.shippingTooExpensive) {
      await handleNoCoverage({ reference, record: manualRecord, error: err });
      return Response.json(
        { error: `${err.message} Al cliente ya le llegó un correo y Mystery le devuelve el dinero.` },
        { status: 422 }
      );
    }
    console.error("[fabricante-generate-shipment] Falló la creación de guía en Skydropx:", err);
    return Response.json(
      { error: err.message || "No se pudo generar la guía en Skydropx." },
      { status: 502 }
    );
  }

  if (!shipment.trackingNumber) {
    return Response.json(
      {
        error: shipment.shipmentId
          ? "La guía YA se creó, pero la transportadora todavía no entrega el número. Espera 1 o 2 minutos y toca \"Generar guía nueva\" otra vez: se retoma esta misma guía, no se crea ni se cobra otra."
          : "Skydropx no devolvió un número de guía tras reintentar.",
      },
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
      reference,
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

  // La guía salió por Servientrega (ver pickRate en skydropx.js).
  if (shipment.requiresExtraProtection) {
    try {
      await sendExtraProtectionEmail({
        order: manualRecord.order,
        customer: manualRecord.customer,
        trackingNumber: shipment.trackingNumber,
      });
    } catch (emailErr) {
      console.error("[fabricante-generate-shipment] Falló el aviso de protección extra:", emailErr);
    }
  }

  return Response.json({
    ok: true,
    order: updated || order,
    requiresExtraProtection: shipment.requiresExtraProtection,
  });
}
