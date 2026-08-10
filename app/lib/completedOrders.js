import Redis from "ioredis";

// Registro persistente de cada pedido CONFIRMADO (pago aprobado) — a
// diferencia de pendingOrders.js (que se borra solo, TTL corto, antes
// de pagar), esto vive indefinidamente porque lo necesita el cron de
// reseñas (/api/cron/send-review-emails) varios días después de la
// compra. Ni IndexedDB del cliente ni orders:<email> (loyalty.js, que
// solo trae reference/date/amountCOP) alcanzan para eso — de ahí este
// registro nuevo, con justo los campos que la reseña necesita.
//
// Se guarda como una única LIST (mismo patrón que catalog:products en
// catalog.js) en vez de una key por pedido: así el cron puede traer
// todo y filtrar en JS sin depender de KEYS/SCAN de Redis. Al volumen
// actual de pedidos esto es totalmente razonable; si el catálogo de
// pedidos crece mucho, se puede migrar a un ZSET ordenado por
// purchasedAt sin cambiar la interfaz pública de este archivo.

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.on("error", (err) => {
      console.error("[completedOrders] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

const COMPLETED_ORDERS_KEY = "completed-orders";

// Nunca lanza: registrar esto es un "extra" para la campaña de
// reseñas, no debe poder tumbar la confirmación de un pago real si
// Redis falla — mismo principio que el resto de confirmApprovedOrder.
export async function saveCompletedOrder({ order, customer, transaction }) {
  const client = getRedisClient();
  if (!client) {
    console.error("[completedOrders] REDIS_URL no está configurado; no se guardó el registro.");
    return false;
  }

  try {
    const record = {
      reference: transaction.reference,
      customerEmail: customer.email,
      customerName: customer.fullName,
      // Solo presente en pedidos del catálogo (/producto/[id]) — los de
      // /crear no tienen productId. thumbnailUrl viene del mockup
      // público de Drive (una URL corta), NUNCA de order.croppedImage
      // (un data URL de varios MB) — eso inflaría cada registro y no
      // hace falta para el correo de reseña.
      productId: order.productId || null,
      thumbnailUrl: order.productId ? order.croppedImage : null,
      sizeLabel: order.sizeLabel,
      purchasedAt: new Date().toISOString(),
      reviewEmailSentAt: null,
      reviewSubmittedAt: null,
    };

    await client.rpush(COMPLETED_ORDERS_KEY, JSON.stringify(record));
    return true;
  } catch (err) {
    console.error("[completedOrders] No se pudo guardar el registro:", err);
    return false;
  }
}

// Nunca lanza — si Redis no está disponible, el cron simplemente no
// tiene nada que procesar esta corrida (se loguea, se reintenta al
// día siguiente).
export async function getCompletedOrders() {
  const client = getRedisClient();
  if (!client) return [];

  try {
    const raw = await client.lrange(COMPLETED_ORDERS_KEY, 0, -1);
    return raw
      .map((entry) => {
        try {
          return JSON.parse(entry);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    console.error("[completedOrders] No se pudo leer los registros:", err);
    return [];
  }
}

export async function getCompletedOrderByReference(reference) {
  const orders = await getCompletedOrders();
  return orders.find((o) => o.reference === reference) || null;
}

// Read-modify-write sobre la LIST completa — mismo patrón que
// incrementProductSalesCount en catalog.js (no hay una key por pedido
// para hacer un simple SET del campo). `updates` se mergea sobre el
// registro encontrado. Nunca lanza.
async function updateCompletedOrder(reference, updates) {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const raw = await client.lrange(COMPLETED_ORDERS_KEY, 0, -1);
    const index = raw.findIndex((entry) => {
      try {
        return JSON.parse(entry).reference === reference;
      } catch {
        return false;
      }
    });

    if (index === -1) {
      console.error(`[completedOrders] No existe un registro para reference=${reference}`);
      return false;
    }

    const record = { ...JSON.parse(raw[index]), ...updates };
    await client.lset(COMPLETED_ORDERS_KEY, index, JSON.stringify(record));
    return true;
  } catch (err) {
    console.error("[completedOrders] No se pudo actualizar el registro:", err);
    return false;
  }
}

export async function markReviewEmailSent(reference) {
  return updateCompletedOrder(reference, { reviewEmailSentAt: new Date().toISOString() });
}

export async function markReviewSubmitted(reference) {
  return updateCompletedOrder(reference, { reviewSubmittedAt: new Date().toISOString() });
}
