import Redis from "ioredis";

// Historial simple de pedidos por correo en Redis (Upstash, conectado en
// Vercel como integración "Redis"), para detectar clientes recurrentes.
// Requiere la variable de entorno REDIS_URL (connection string). Sin ella
// —por ejemplo en dev local si no se configuró— las funciones fallan de
// forma controlada y el pedido sigue su curso normal como si no fuera
// cliente recurrente.

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    // Sin este listener, un error de conexión emitido de forma asíncrona
    // por ioredis puede terminar como una excepción no capturada y tumbar
    // el proceso; con el listener, el error simplemente se loguea.
    redisClient.on("error", (err) => {
      console.error("[loyalty] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

function orderHistoryKey(email) {
  return `orders:${email.trim().toLowerCase()}`;
}

// Agrega el pedido actual al historial del correo (RPUSH) y devuelve si el
// cliente ya tenía al menos un pedido previo guardado (LLEN antes de
// agregar el nuevo). Nunca lanza: si Redis no está disponible o falla,
// retorna isReturningCustomer: false para no bloquear la confirmación del
// pago.
export async function recordOrderAndCheckReturning({
  email,
  reference,
  amountCOP,
  trackingNumber,
  carrierName,
}) {
  const client = getRedisClient();
  if (!client) {
    console.error(
      "[loyalty] REDIS_URL no está configurado; se omite el registro en Redis."
    );
    return false;
  }

  try {
    const key = orderHistoryKey(email);
    const previousOrderCount = await client.llen(key);
    const isReturningCustomer = previousOrderCount > 0;

    const record = JSON.stringify({
      reference,
      date: new Date().toISOString(),
      amountCOP,
      // Solo presentes en pedidos contraentrega con guía generada por
      // Skydropx; undefined se omite naturalmente al serializar a JSON.
      trackingNumber,
      carrierName,
    });
    await client.rpush(key, record);

    return isReturningCustomer;
  } catch (err) {
    console.error("[loyalty] No se pudo acceder a Redis:", err);
    return false;
  }
}
