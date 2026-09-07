// Siembra home:testimonials con testimonios REALES tomados de Instagram
// (comentarios/DMs/posts etiquetados de clientes reales) mientras llegan
// suficientes reseñas del sitio (el cron semanal, ver
// app/api/cron/select-home-testimonials/route.js, los reemplaza solo en
// cuanto haya 4+ reseñas reales calificadas ahí). Sin foto a propósito:
// no se le pide foto al cliente en ningún lado, mostrar una genérica
// daría a entender que es del cuadro de ese cliente sin serlo.
//
// Completa INSTAGRAM_TESTIMONIALS abajo con el texto real (tal cual lo
// escribió cada cliente, sin inventar ni exagerar) antes de correr esto.
//
// Uso: node --env-file=.env.local scripts/seed-home-testimonials.mjs
import { readFileSync } from "fs";
import Redis from "ioredis";

function loadEnvLocal() {
  let raw;
  try {
    raw = readFileSync(".env.local", "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^['"]/, "").replace(/['"]$/, "");
    if (!process.env[match[1].trim()]) {
      process.env[match[1].trim()] = value;
    }
  }
}

loadEnvLocal();

if (!process.env.REDIS_URL) {
  console.error("Falta REDIS_URL (revisa .env.local).");
  process.exit(1);
}

const HOME_TESTIMONIALS_KEY = "home:testimonials";

// TODO: reemplazar con el texto real de Instagram. nombre en formato
// "Nombre I." (inicial de apellido, mismo criterio de privacidad que
// formatCustomerDisplayName en app/lib/homeTestimonials.js). sizeLabel es
// opcional (null si no se sabe qué tamaño compró ese cliente).
const INSTAGRAM_TESTIMONIALS = [
  // { nombre: "Nombre I.", texto: "...", sizeLabel: "40 x 50 cm", rating: 5 },
];

if (INSTAGRAM_TESTIMONIALS.length === 0) {
  console.error(
    "INSTAGRAM_TESTIMONIALS está vacío — completa el array en este script con el texto real antes de correrlo."
  );
  process.exit(1);
}

const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000 });

try {
  await redis.set(HOME_TESTIMONIALS_KEY, JSON.stringify(INSTAGRAM_TESTIMONIALS));
  console.log(
    `Listo — ${INSTAGRAM_TESTIMONIALS.length} testimonios de Instagram guardados en ${HOME_TESTIMONIALS_KEY}.`
  );
} finally {
  redis.disconnect();
}
