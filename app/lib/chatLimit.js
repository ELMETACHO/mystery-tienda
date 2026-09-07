import Redis from "ioredis";

// Límite de mensajes por sesión de chat (ver app/lib/chatSession.js): 5
// mensajes por 24h, contados por sesión anónima en Redis. Mismo patrón de
// conexión que el resto de app/lib (catalog.js, reviews.js, etc).
//
// Fail-open a propósito, mismo criterio que app/lib/rateLimit.js: si
// Redis no responde, no se bloquea al cliente por un problema de
// infraestructura — la protección real contra abuso en ese escenario la
// sigue dando el rate limit por IP (checkRateLimit), independiente de
// este contador.

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.on("error", (err) => {
      console.error("[chatLimit] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

export const MAX_CHAT_MESSAGES = 5;
const WINDOW_SECONDS = 24 * 60 * 60;

// Incrementa el contador de la sesión y devuelve si ya llegó al límite.
// Se llama ANTES de gastar una llamada a Claude — si limited es true, el
// endpoint nunca debe llegar a llamar a la IA por ese mensaje.
export async function incrementChatMessageCount(sessionId) {
  const client = getRedisClient();
  if (!client) return { count: 1, limited: false };

  try {
    const key = `chat:count:${sessionId}`;
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, WINDOW_SECONDS);
    }
    return { count, limited: count > MAX_CHAT_MESSAGES };
  } catch (err) {
    console.error("[chatLimit] No se pudo incrementar el contador:", err);
    return { count: 1, limited: false };
  }
}
