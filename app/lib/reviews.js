import Redis from "ioredis";
import { effectiveReviewStatus, isPubliclyVisible, toPublicReview } from "./reviewModeration";

// Reseñas de clientes. Alimentan, vía getReviews(), el cron semanal que
// selecciona testimonios reales para el Home (ver
// app/lib/homeTestimonials.js) y, desde que existen las reseñas con foto,
// las secciones públicas "Fotos de clientes" (Home, /ads) y la lista de
// reseñas de /producto/[id] — estas últimas SOLO con reseñas aprobadas en
// /admin/resenas y con consentimiento del cliente (ver
// app/lib/reviewModeration.js). Mismo patrón de LIST + filtro en JS que
// el resto de app/lib (catalog.js, completedOrders.js).
//
// Claves en Redis:
// - reviews                      LIST con el JSON de cada reseña (append-only).
// - reviews:moderation           HASH id -> {status, at} (aprobar/rechazar sin
//                                reescribir la LIST).
// - review-photo:{id}            foto JPEG (base64) ya reducida y SIN metadatos
//                                (sharp quita EXIF/GPS), ~100-250 KB.
// - review-submitted-lock:{ref}  SET NX: una sola reseña por pedido aunque
//                                lleguen dos envíos al mismo tiempo.

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
const MODERATION_KEY = "reviews:moderation";
const PHOTO_KEY_PREFIX = "review-photo:";
const SUBMIT_LOCK_PREFIX = "review-submitted-lock:";

// Reserva atómica "una reseña por pedido" (SET NX). Devuelve true si este
// request es el primero; false si otro ya la reservó. Si luego falla el
// guardado, quien llama debe liberar con releaseReviewSlot.
export async function claimReviewSlot(reference) {
  const client = getRedisClient();
  if (!client) {
    throw new Error("REDIS_URL no está configurado; no se pudo guardar la reseña.");
  }
  const result = await client.set(`${SUBMIT_LOCK_PREFIX}${reference}`, "1", "EX", 60 * 60 * 24 * 400, "NX");
  return result === "OK";
}

export async function releaseReviewSlot(reference) {
  const client = getRedisClient();
  if (!client) return;
  await client.del(`${SUBMIT_LOCK_PREFIX}${reference}`).catch(() => {});
}

export async function saveReview({
  id = null,
  reference,
  productId,
  rating,
  comment,
  consent = false,
  displayName = null,
  sizeLabel = null,
  photoJpeg = null,
}) {
  const client = getRedisClient();
  if (!client) {
    throw new Error("REDIS_URL no está configurado; no se pudo guardar la reseña.");
  }

  const review = {
    ...(id ? { id, status: "pending", consent: consent === true } : {}),
    reference,
    productId: productId || null,
    rating,
    comment: comment || null,
    ...(id ? { displayName, sizeLabel, hasPhoto: Boolean(photoJpeg) } : {}),
    submittedAt: new Date().toISOString(),
  };

  // La foto primero: si la LIST quedara con hasPhoto=true sin foto, la
  // tarjeta mostraría una imagen rota.
  if (id && photoJpeg) {
    await client.set(`${PHOTO_KEY_PREFIX}${id}`, photoJpeg.toString("base64"));
  }
  await client.rpush(REVIEWS_KEY, JSON.stringify(review));
  return review;
}

async function getModerationMap(client) {
  const raw = await client.hgetall(MODERATION_KEY);
  const map = {};
  for (const [id, value] of Object.entries(raw || {})) {
    try {
      map[id] = JSON.parse(value);
    } catch {
      // entrada corrupta: se ignora (la reseña queda en su estado original)
    }
  }
  return map;
}

// Mapa id -> {status, at} para el cron de testimonios. Nunca lanza.
export async function getReviewModeration() {
  const client = getRedisClient();
  if (!client) return {};
  try {
    return await getModerationMap(client);
  } catch (err) {
    console.error("[reviews] No se pudo leer la moderación:", err);
    return {};
  }
}

// Para /admin/resenas: TODAS las reseñas con su estado efectivo, más
// nuevas primero. Lanza si Redis falla (el admin debe verlo).
export async function getReviewsForAdmin() {
  const client = getRedisClient();
  if (!client) throw new Error("REDIS_URL no está configurado.");
  const [raw, moderation] = await Promise.all([client.lrange(REVIEWS_KEY, 0, -1), getModerationMap(client)]);
  return raw
    .map((entry) => {
      try {
        return JSON.parse(entry);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .map((r) => ({ ...r, status: effectiveReviewStatus(r, moderation) }))
    .reverse();
}

export async function setReviewStatus(id, status) {
  const client = getRedisClient();
  if (!client) throw new Error("REDIS_URL no está configurado.");
  await client.hset(MODERATION_KEY, id, JSON.stringify({ status, at: new Date().toISOString() }));
  // Rechazada = la foto no se va a publicar nunca: se borra (minimización
  // de datos personales). El texto queda para el historial interno.
  if (status === "rejected") await client.del(`${PHOTO_KEY_PREFIX}${id}`);
  approvedCache = null;
}

// Caché en memoria de la instancia (5 min): /producto/[id] y
// /api/reviews/approved no golpean Redis en cada visita. Al aprobar o
// rechazar se invalida en la instancia del admin; las demás se ponen al
// día en ≤5 min (aceptable para reseñas).
const APPROVED_CACHE_MS = 5 * 60 * 1000;
let approvedCache = null;

// Nunca lanza: si Redis falla, simplemente no se muestran reseñas.
export async function getApprovedReviews() {
  if (approvedCache && Date.now() - approvedCache.at < APPROVED_CACHE_MS) return approvedCache.reviews;
  const client = getRedisClient();
  if (!client) return [];
  try {
    const [raw, moderation] = await Promise.all([client.lrange(REVIEWS_KEY, 0, -1), getModerationMap(client)]);
    const reviews = raw
      .map((entry) => {
        try {
          return JSON.parse(entry);
        } catch {
          return null;
        }
      })
      .filter((r) => r && isPubliclyVisible(r, moderation))
      .map(toPublicReview)
      .reverse();
    approvedCache = { at: Date.now(), reviews };
    return reviews;
  } catch (err) {
    console.error("[reviews] No se pudo leer las reseñas aprobadas:", err);
    return [];
  }
}

// Foto de una reseña (Buffer JPEG) o null. Quien llama decide si se puede
// mostrar (aprobada + consentimiento, o admin).
export async function getReviewPhoto(id) {
  const client = getRedisClient();
  if (!client) return null;
  try {
    const b64 = await client.get(`${PHOTO_KEY_PREFIX}${id}`);
    return b64 ? Buffer.from(b64, "base64") : null;
  } catch (err) {
    console.error("[reviews] No se pudo leer la foto:", err);
    return null;
  }
}

// Todas las reseñas guardadas, sin filtrar — usado por el cron semanal
// que selecciona testimonios reales para el Home (ver
// app/api/cron/select-home-testimonials/route.js). Nunca lanza, mismo
// principio que getReviewsByProductId: si Redis falla, el cron
// simplemente no tiene nada que procesar esta corrida.
export async function getReviews() {
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
      .filter(Boolean);
  } catch (err) {
    console.error("[reviews] No se pudo leer las reseñas:", err);
    return [];
  }
}

// Sin uso (incluye pendientes y rechazadas). Para mostrar en público usar
// getApprovedReviews().
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
