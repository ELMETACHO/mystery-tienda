import Redis from "ioredis";

// Reseñas de clientes — guardadas, pero NO mostradas públicamente
// todavía en /producto/[id] (tarea aparte, a futuro). Mismo patrón de
// LIST + filtro en JS que el resto de app/lib (catalog.js,
// completedOrders.js).

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.on("error", (err) => {
      console.error("[reviews] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

const REVIEWS_KEY = "reviews";

// SÍ lanza si Redis falla: a diferencia de leer reseñas (donde no pasa
// nada grave si por ahora no se pueden mostrar), guardar la reseña es
// el propósito completo de /api/submit-review — si falla, el cliente
// debe verlo en pantalla en vez de creer que su reseña quedó guardada.
export async function saveReview({ reference, productId, rating, comment }) {
  const client = getRedisClient();
  if (!client) {
    throw new Error("REDIS_URL no está configurado; no se pudo guardar la reseña.");
  }

  const review = {
    reference,
    productId: productId || null,
    rating,
    comment: comment || null,
    submittedAt: new Date().toISOString(),
  };

  await client.rpush(REVIEWS_KEY, JSON.stringify(review));
  return review;
}

// Sin uso todavía (las reseñas no se muestran en ningún lado por
// ahora) — queda lista para cuando se aborde esa tarea aparte.
export async function getReviewsByProductId(productId) {
  const client = getRedisClient();
  if (!client) return [];

  try {
    const raw = await client.lrange(REVIEWS_KEY, 0, -1);
    return raw
      .map((entry) => {
        try {
          return JSON.parse(entry);
        } catch {
          return null;
        }
      })
      .filter((review) => review && review.productId === productId);
  } catch (err) {
    console.error("[reviews] No se pudo leer las reseñas:", err);
    return [];
  }
}
