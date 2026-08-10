import { createHash } from "crypto";
import { getPendingOrder } from "../../lib/pendingOrders";
import { confirmApprovedOrder } from "../../lib/confirmApprovedOrder";

// Notificación server-to-server de Wompi ("Eventos"): se entera de un
// pago aprobado sin depender de que el navegador del cliente siga
// abierto — la red de seguridad para el bug conocido donde el cliente
// paga, cierra la pestaña y /api/confirm-order (disparado desde el
// navegador) nunca llega a ejecutarse.
//
// Referencia: https://docs.wompi.co/en/docs/colombia/eventos/

// Lee un campo con notación de puntos (ej. "transaction.id") desde el
// objeto `data` del evento — así sirve sin importar qué campos exactos
// liste `signature.properties`.
function getByPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

// Valida el checksum del evento contra nuestro Event Secret — la única
// forma de confirmar que el request realmente viene de Wompi y no fue
// falsificado. Algoritmo exacto de Wompi: SHA256 de la concatenación de
// (a) los valores de los campos listados en signature.properties, en
// ese orden, (b) el timestamp del evento, y (c) el Event Secret.
function isValidChecksum(body) {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret) {
    console.error("[wompi-webhook] Falta WOMPI_EVENTS_SECRET — no se puede validar ningún evento.");
    return false;
  }

  const properties = body?.signature?.properties;
  const receivedChecksum = body?.signature?.checksum;
  const timestamp = body?.timestamp;

  if (!Array.isArray(properties) || !receivedChecksum || timestamp == null) {
    return false;
  }

  const concatenated =
    properties.map((path) => String(getByPath(body.data, path))).join("") +
    String(timestamp) +
    secret;

  const expectedChecksum = createHash("sha256").update(concatenated).digest("hex");

  return expectedChecksum.toLowerCase() === String(receivedChecksum).toLowerCase();
}

export async function POST(request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  // El checksum también viaja en el header X-Event-Checksum, pero
  // signature.checksum (dentro del body) es equivalente — se usa el
  // del body para no depender de que el header llegue intacto a través
  // de cualquier proxy/capa intermedia.
  if (!isValidChecksum(body)) {
    console.error("[wompi-webhook] Checksum inválido — evento rechazado.");
    return Response.json({ error: "Checksum inválido" }, { status: 401 });
  }

  const transaction = body?.data?.transaction;

  // Cualquier evento que no sea una transacción aprobada se reconoce
  // con 200 (para que Wompi no reintente) pero no dispara ninguna
  // acción — esto incluye transaction.updated con otros estados
  // (DECLINED/ERROR/PENDING) y cualquier otro tipo de evento futuro.
  if (body.event !== "transaction.updated" || transaction?.status !== "APPROVED") {
    return Response.json({ ok: true, ignored: true });
  }

  const pending = await getPendingOrder(transaction.reference);
  if (!pending) {
    // No hay nada que podamos confirmar sin order/customer — no tiene
    // sentido que Wompi reintente (no va a aparecer un pedido pendiente
    // por reintentar), así que se reconoce con 200 igual, pero se loguea
    // fuerte para revisar a mano (ej. pedidos de antes de este cambio,
    // o el pago contraentrega, que todavía no guarda pedido pendiente).
    console.error(
      `[wompi-webhook] No hay pedido pendiente guardado para reference=${transaction.reference} (transactionId=${transaction.id})`
    );
    return Response.json({ ok: true, missingPendingOrder: true });
  }

  try {
    await confirmApprovedOrder({
      order: pending.order,
      customer: pending.customer,
      transaction,
    });
  } catch (err) {
    console.error("[wompi-webhook] Falló la confirmación del pedido:", err);
    // Respuesta distinta de 200: Wompi reintenta este mismo evento más
    // adelante (hasta 3 veces en 24h) — útil si el fallo fue algo
    // transitorio (ej. Resend caído un momento).
    return Response.json({ error: "Falló la confirmación" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
