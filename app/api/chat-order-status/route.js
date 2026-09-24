import { findLatestManualShipmentByContact } from "../../lib/manualShipments";
import { checkRateLimit, rateLimitResponse } from "../../lib/rateLimit";

// Búsqueda de estado de pedido desde el chatbot (ver ChatWidget.jsx) — a
// propósito NO pasa por la IA: la respuesta se arma acá con datos reales
// de Redis, para que nunca invente un número de guía o una fecha. Solo
// devuelve estado/guía, nunca nombre/dirección completos (mismo dato que
// vería cualquier persona que escriba el teléfono/correo del cliente —
// límite de tasa más estricto que el resto del chat para no facilitar
// consultar números al azar).
export async function POST(request) {
  const { limited, retryAfter } = await checkRateLimit(request, "chat-order-status", {
    limit: 8,
    windowSeconds: 60,
  });
  if (limited) return rateLimitResponse(retryAfter);

  const { contact } = await request.json().catch(() => ({}));
  const raw = String(contact || "").trim();
  if (!raw) return Response.json({ error: "Falta el dato de contacto" }, { status: 400 });

  const isEmail = raw.includes("@");
  const record = await findLatestManualShipmentByContact(
    isEmail ? { email: raw } : { phone: raw }
  );

  if (!record) {
    return Response.json({
      found: false,
      message:
        "No encontramos un pedido reciente con ese dato. Revisa que esté bien escrito (el mismo correo o celular que usaste al pagar), o escríbenos por WhatsApp: https://wa.me/573202646716",
    });
  }

  const sizeLabel = record.order?.sizeLabel || "tu cuadro";

  if (record.status === "generated" && record.trackingNumber) {
    const link = record.trackingUrl || record.labelUrl;
    return Response.json({
      found: true,
      status: "generated",
      message:
        `¡Tu pedido de ${sizeLabel} ya está en camino! ${record.carrierName || "La transportadora"} ya lo tiene, ` +
        `número de guía ${record.trackingNumber}. Normalmente tarda entre 1 y 2 días más en llegar.` +
        (link ? ` Puedes rastrearlo aquí: ${link}` : ""),
    });
  }

  // Envío por encima del tope de costo (ver app/lib/noCoverage.js).
  if (record.status === "no_coverage") {
    return Response.json({
      found: true,
      status: "no_coverage",
      message:
        "Por ahora no tenemos envíos disponibles a tu ciudad, así que la devolución de tu dinero ya quedó programada — te enviamos los detalles a tu correo. Si tienes dudas, escríbenos a contacto@elmetacho.com.",
    });
  }

  return Response.json({
    found: true,
    status: "pending",
    message: `Tu pedido de ${sizeLabel} está en producción — en cuanto salga hacia la transportadora te llega el número de guía por correo. Normalmente todo el proceso toma entre 3 y 5 días hábiles.`,
  });
}
