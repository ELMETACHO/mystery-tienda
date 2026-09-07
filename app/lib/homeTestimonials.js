import Redis from "ioredis";

// Selección de testimonios reales mostrados en el Home (sección de
// reseñas) — la arma semanalmente el cron
// app/api/cron/select-home-testimonials/route.js a partir de reseñas
// reales de app/lib/reviews.js. Se guarda como UN solo valor JSON (no una
// LIST) porque siempre se lee/escribe entero: no hace falta ni tiene
// sentido paginar 4-6 testimonios.

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.on("error", (err) => {
      console.error("[homeTestimonials] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

const HOME_TESTIMONIALS_KEY = "home:testimonials";

// Nunca lanza: si no hay testimonios reales guardados todavía (o Redis no
// responde), el Home debe poder caer a su fallback de ejemplo en vez de
// romper la página.
export async function getHomeTestimonials() {
  const client = getRedisClient();
  if (!client) return [];

  try {
    const raw = await client.get(HOME_TESTIMONIALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("[homeTestimonials] No se pudo leer la selección:", err);
    return [];
  }
}

// SÍ lanza si Redis falla — lo llama tanto el cron semanal como el script
// de siembra inicial (scripts/seed-home-testimonials.mjs), y en ambos
// casos quien llama necesita saber si la escritura falló de verdad para
// no reportar éxito falso.
export async function saveHomeTestimonials(testimonials) {
  const client = getRedisClient();
  if (!client) {
    throw new Error("REDIS_URL no está configurado; no se pudo guardar la selección.");
  }

  await client.set(HOME_TESTIMONIALS_KEY, JSON.stringify(testimonials));
}

// "Camila Restrepo Gómez" -> "Camila R." — mismo formato que ya usaban
// los testimonios de ejemplo en app/page.js, solo que ahora es una
// función reutilizable en vez de texto tipeado a mano. Nombres de una
// sola palabra se muestran completos (no hay apellido que inicializar).
export function formatCustomerDisplayName(fullName) {
  if (!fullName || typeof fullName !== "string") return "Cliente Mystery";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Cliente Mystery";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}
