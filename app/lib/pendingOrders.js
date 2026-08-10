import Redis from "ioredis";

// Pedido pendiente guardado por `reference` de Wompi, ANTES de que el
// cliente pague (al abrir el widget) — así tanto el camino normal
// (cliente regresa y llama a /api/confirm-order) como el webhook de
// Wompi (/api/wompi-webhook, que nunca ve el navegador del cliente)
// tienen acceso a los mismos datos de order/customer, sin depender de
// IndexedDB del navegador. Mismo patrón de conexión que
// app/lib/loyalty.js y app/lib/catalog.js (cliente ioredis propio).

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.on("error", (err) => {
      console.error("[pendingOrders] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

function pendingOrderKey(reference) {
  return `pending-order:${reference}`;
}

// TTL de 2 días: más que suficiente para cubrir la ventana de
// reintentos de webhooks de Wompi (hasta 24h) más margen — no tiene
// sentido guardar pedidos pendientes indefinidamente si nunca se
// confirman (el cliente nunca pagó, o abandonó el pago).
const PENDING_ORDER_TTL_SECONDS = 60 * 60 * 24 * 2;

// Nunca lanza: si Redis falla acá, el cliente que sí regresa a la
// pestaña de todas formas puede confirmar su pedido normalmente (ver
// checkout/page.js, que sigue enviando order/customer directo en el
// body de /api/confirm-order) — este guardado es solo la red de
// seguridad para el webhook, no una dependencia dura del flujo normal.
export async function savePendingOrder({ reference, order, customer }) {
  const client = getRedisClient();
  if (!client) {
    console.error("[pendingOrders] REDIS_URL no está configurado; no se guardó el pedido pendiente.");
    return false;
  }

  try {
    await client.set(
      pendingOrderKey(reference),
      JSON.stringify({ order, customer }),
      "EX",
      PENDING_ORDER_TTL_SECONDS
    );
    return true;
  } catch (err) {
    console.error("[pendingOrders] No se pudo guardar el pedido pendiente:", err);
    return false;
  }
}

// Nunca lanza — si Redis falla o no hay nada guardado para esa
// reference, el llamador (el webhook) simplemente no puede confirmar
// ese pedido y lo loguea, sin romper el endpoint.
export async function getPendingOrder(reference) {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const raw = await client.get(pendingOrderKey(reference));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("[pendingOrders] No se pudo leer el pedido pendiente:", err);
    return null;
  }
}
