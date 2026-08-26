import Redis from "ioredis";

// Limitador por IP sobre el mismo Redis (Upstash) que ya usa el resto del
// proyecto (REDIS_URL, vía ioredis). No se usa el paquete @upstash/ratelimit
// porque ese está pensado para el cliente REST @upstash/redis (otras
// variables de entorno, otro protocolo) — este archivo implementa el mismo
// resultado (ventana fija por IP) con el cliente ioredis que ya está
// configurado, sin depender de credenciales adicionales.
//
// Nunca debe poder tumbar un endpoint si Redis falla: si no hay conexión,
// se deja pasar la solicitud (fail-open) en vez de bloquear pagos reales
// por un problema de infraestructura ajeno al límite de abuso.

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.on("error", (err) => {
      console.error("[rateLimit] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

// Ventana fija: hasta `limit` solicitudes por IP+scope cada `windowSeconds`.
// Devuelve { limited: false } si se puede continuar, o { limited: true,
// retryAfter } si se debe rechazar con 429.
export async function checkRateLimit(request, scope, { limit = 10, windowSeconds = 60 } = {}) {
  const client = getRedisClient();
  if (!client) return { limited: false };

  const ip = getClientIp(request);
  const key = `ratelimit:${scope}:${ip}`;

  try {
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, windowSeconds);
    }

    if (count > limit) {
      const ttl = await client.ttl(key);
      return { limited: true, retryAfter: ttl > 0 ? ttl : windowSeconds };
    }

    return { limited: false };
  } catch (err) {
    console.error(`[rateLimit] Error verificando límite (${scope}):`, err);
    return { limited: false };
  }
}

export function rateLimitResponse(retryAfter) {
  return Response.json(
    { error: "Demasiadas solicitudes. Intenta de nuevo en unos minutos." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
