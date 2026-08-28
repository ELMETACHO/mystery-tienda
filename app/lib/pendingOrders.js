import Redis from "ioredis";

// Pedido pendiente guardado por `reference` de Wompi, ANTES de que el
// cliente pague (al abrir el widget) — así tanto el camino normal
// (cliente regresa y llama a /api/confirm-order) como el webhook de
// Wompi (/api/wompi-webhook, que nunca ve el navegador del cliente)
// tienen acceso a los mismos datos de order/customer, sin depender de
// IndexedDB del navegador. Mismo patrón de conexión que
// app/lib/loyalty.js y app/lib/catalog.js (cliente ioredis propio).
//
// También es la fuente de "carritos abandonados" para el cron de
// recuperación (/api/cron/send-cart-recovery-emails): un pending-order
// que sigue existiendo pasada 1h y nunca se confirmó (no aparece en
// completed-orders) es, por definición, un carrito abandonado.

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

const PENDING_ORDER_PREFIX = "pending-order:";

function pendingOrderKey(reference) {
  return `${PENDING_ORDER_PREFIX}${reference}`;
}

// TTL de 2 días: más que suficiente para cubrir la ventana de
// reintentos de webhooks de Wompi (hasta 24h) más margen — no tiene
// sentido guardar pedidos pendientes indefinidamente si nunca se
// confirman (el cliente nunca pagó, o abandonó el pago). También pone
// un límite natural a cuánto tiempo puede vivir un "carrito
// abandonado" antes de dejar de intentarse recuperar.
const PENDING_ORDER_TTL_SECONDS = 60 * 60 * 24 * 2;

// Nunca lanza: si Redis falla acá, el cliente que sí regresa a la
// pestaña de todas formas puede confirmar su pedido normalmente (ver
// checkout/page.js, que sigue enviando order/customer directo en el
// body de /api/confirm-order) — este guardado es solo la red de
// seguridad para el webhook, no una dependencia dura del flujo normal.
export async function savePendingOrder({ reference, order, customer, paymentMethod = "wompi" }) {
  const client = getRedisClient();
  if (!client) {
    console.error("[pendingOrders] REDIS_URL no está configurado; no se guardó el pedido pendiente.");
    return false;
  }

  try {
    await client.set(
      pendingOrderKey(reference),
      JSON.stringify({
        reference,
        order,
        customer,
        // "wompi" (pago completo) o "cod" (anticipo contraentrega) — le
        // dice a /api/wompi-webhook cuál función de confirmación llamar
        // (ver confirmApprovedOrder.js vs. confirmApprovedCodOrder.js).
        paymentMethod,
        createdAt: new Date().toISOString(),
        cartRecoveryEmailSentAt: null,
      }),
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

// A diferencia de catalog.js/completedOrders.js (una sola LIST), cada
// pending-order vive en su propia key con su propio TTL — necesario
// para que cada uno expire por separado a los 2 días exactos desde que
// se creó, algo que una LIST compartida no puede hacer por item. Eso
// significa que para traerlos TODOS (lo que necesita el cron de
// recuperación) no queda otra que recorrer las keys con SCAN — a este
// volumen de pedidos pendientes es perfectamente razonable, y Upstash
// lo soporta igual que cualquier Redis.
export async function getAllPendingOrders() {
  const client = getRedisClient();
  if (!client) return [];

  try {
    const keys = [];
    let cursor = "0";
    do {
      const [nextCursor, batch] = await client.scan(
        cursor,
        "MATCH",
        `${PENDING_ORDER_PREFIX}*`,
        "COUNT",
        100
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== "0");

    if (keys.length === 0) return [];

    const raw = await client.mget(...keys);
    return raw
      .map((entry, i) => {
        if (!entry) return null;
        try {
          const parsed = JSON.parse(entry);
          // Compatibilidad con pending-orders guardados antes de este
          // cambio, que no tienen `reference` embebido en el valor
          // (solo estaba en la key) — se recupera de la key como
          // respaldo para que el cron igual pueda procesarlos.
          return { reference: keys[i].slice(PENDING_ORDER_PREFIX.length), ...parsed };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    console.error("[pendingOrders] No se pudo listar los pedidos pendientes:", err);
    return [];
  }
}

// Marca el pending-order como "ya se le mandó el correo de recuperación"
// para que el cron no lo vuelva a enviar en la próxima corrida — usa
// SET ... KEEPTTL para no reiniciar el TTL de 2 días original al
// actualizar el valor (si no, un pedido que ya llevaba 1 día y medio
// pendiente volvería a tener 2 días completos por delante).
export async function markCartRecoveryEmailSent(reference) {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const raw = await client.get(pendingOrderKey(reference));
    if (!raw) {
      console.error(`[pendingOrders] No existe un pending-order para reference=${reference}`);
      return false;
    }

    const record = { ...JSON.parse(raw), cartRecoveryEmailSentAt: new Date().toISOString() };
    await client.set(pendingOrderKey(reference), JSON.stringify(record), "KEEPTTL");
    return true;
  } catch (err) {
    console.error("[pendingOrders] No se pudo marcar el correo de recuperación como enviado:", err);
    return false;
  }
}
