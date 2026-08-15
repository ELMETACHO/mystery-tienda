import Redis from "ioredis";

// Datos completos de order/customer guardados por `reference`, para que el
// fabricante pueda generar la guía de Skydropx días después de la compra
// (botón "✅ Ya está listo — generar guía ahora" en su correo, ver
// app/lib/email.js y app/api/generate-shipment/route.js) sin depender de
// IndexedDB del cliente (que para ese momento puede ya ni existir en su
// navegador). Mismo patrón de conexión que el resto de app/lib/*.js
// (cliente ioredis propio).
//
// A diferencia de pendingOrders.js (TTL corto, se usa ANTES de pagar, solo
// como red de seguridad para el webhook) esto se guarda DESPUÉS de
// confirmar el pago y vive hasta 30 días — tiempo de sobra para que el
// fabricante termine de producir el cuadro y genere la guía.

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.on("error", (err) => {
      console.error("[manualShipments] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

function manualShipmentKey(reference) {
  return `manual-shipment:${reference}`;
}

const MANUAL_SHIPMENT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 días

// Nunca lanza: si esto falla, el pedido de todos modos ya se confirmó (ver
// confirmApprovedOrder.js / app/api/confirm-cod-order/route.js) — el único
// efecto de que esto falle es que el botón del correo del fabricante no
// vaya a poder generar la guía automáticamente más adelante (se loguea
// fuerte para poder detectarlo).
export async function saveManualShipmentRequest({
  reference,
  order,
  customer,
  paymentMethod,
  saldoPendiente,
}) {
  const client = getRedisClient();
  if (!client) {
    console.error(
      "[manualShipments] REDIS_URL no está configurado; no se guardó la solicitud de guía manual."
    );
    return false;
  }

  try {
    // Solo lo que createManualShipment() realmente necesita (ver
    // app/lib/skydropx.js: sizeId para las dimensiones/peso, priceCOP para
    // el declared_value) — NUNCA order.croppedImage/printImage completos de
    // un pedido personalizado. Esos son data URLs de varios MB cada uno;
    // guardarlos acá 30 días por cada pedido inflaría Redis para nada, ya
    // que la guía no necesita la foto.
    //
    // thumbnailUrl es la EXCEPCIÓN segura: solo se guarda cuando el pedido
    // viene del catálogo (order.productId), porque ahí order.croppedImage
    // NO es un data URL pesado sino la miniatura liviana de Drive
    // (product.thumbnailUrl, ver app/lib/catalog.js) — un link de unos
    // pocos bytes, no una imagen completa. Para pedidos de /crear
    // (sin productId) queda en null a propósito; el panel del fabricante
    // (ver app/fabricante/page.js) muestra un ícono genérico en ese caso.
    const minimalOrder = {
      sizeId: order.sizeId,
      sizeLabel: order.sizeLabel,
      priceCOP: order.priceCOP,
      productId: order.productId || null,
      thumbnailUrl: order.productId ? order.croppedImage || null : null,
    };

    const record = {
      reference,
      order: minimalOrder,
      customer,
      paymentMethod, // "cod" | "wompi"
      saldoPendiente: saldoPendiente ?? 0,
      status: "pending", // "pending" | "generated"
      trackingNumber: null,
      carrierName: null,
      labelUrl: null,
      trackingUrl: null,
      savedAt: new Date().toISOString(),
      generatedAt: null,
    };
    await client.set(
      manualShipmentKey(reference),
      JSON.stringify(record),
      "EX",
      MANUAL_SHIPMENT_TTL_SECONDS
    );
    return true;
  } catch (err) {
    console.error("[manualShipments] No se pudo guardar la solicitud de guía manual:", err);
    return false;
  }
}

// Nunca lanza — si Redis falla o no hay nada guardado, el llamador (el
// endpoint del botón) simplemente no puede generar la guía y lo informa
// en la página de resultado.
export async function getManualShipmentRequest(reference) {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const raw = await client.get(manualShipmentKey(reference));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("[manualShipments] No se pudo leer la solicitud de guía manual:", err);
    return null;
  }
}

// Marca la solicitud como "generated" con los datos reales de la guía —
// clave para la IDEMPOTENCIA: si el fabricante hace click en el link dos
// veces (o el correo se abre en dos dispositivos), la segunda vez
// getManualShipmentRequest ya trae status "generated" y
// app/api/generate-shipment/route.js no vuelve a llamar a Skydropx (evita
// cobrar una guía duplicada). Reinicia el TTL a 30 días — no hace daño
// tenerlo un poco más vivo, y simplifica no tener que calcular el
// remanente.
export async function markManualShipmentGenerated(
  reference,
  { trackingNumber, carrierName, labelUrl, trackingUrl, shipmentId }
) {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const existing = await getManualShipmentRequest(reference);
    if (!existing) {
      console.error(
        `[manualShipments] No existe una solicitud guardada para reference=${reference} — no se pudo marcar como generada.`
      );
      return false;
    }

    const updated = {
      ...existing,
      status: "generated",
      shipmentId: shipmentId || null,
      trackingNumber: trackingNumber || null,
      carrierName: carrierName || null,
      labelUrl: labelUrl || null,
      trackingUrl: trackingUrl || null,
      generatedAt: new Date().toISOString(),
    };
    await client.set(
      manualShipmentKey(reference),
      JSON.stringify(updated),
      "EX",
      MANUAL_SHIPMENT_TTL_SECONDS
    );
    return true;
  } catch (err) {
    console.error("[manualShipments] No se pudo marcar la solicitud como generada:", err);
    return false;
  }
}
