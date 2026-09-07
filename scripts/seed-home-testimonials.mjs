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

// Texto real de clientes vía Instagram (confirmado por el dueño el
// 2026-09-07). Se limpiaron solo las etiquetas de tamaño/tema que cada
// cliente agregó entre paréntesis al final de su propio comentario (esa
// info ya vive en sizeLabel) — el contenido de la reseña en sí no se
// tocó. Jorge Vargas: el texto original traía "50X70" al inicio y
// "(30X40...)" al final, contradictorios; el tamaño correcto (50x70) se
// confirmó directamente con el dueño antes de guardar esto.
const INSTAGRAM_TESTIMONIALS = [
  {
    nombre: "Álvaro D.",
    texto: "Ya llegó el cuadro. Quedó muy bien, no tuve problemas con la entrega.",
    sizeLabel: "40 x 50 cm",
  },
  {
    nombre: "Majo C.",
    texto: "Recibí el cuadro 4 días después. Vivo en Huila, lo envió la transportadora Servientrega. ¡Gracias!",
    sizeLabel: "40 x 50 cm",
  },
  {
    nombre: "Jorge V.",
    texto: "Pedí uno para un cumpleaños. Me gustó que el empaque llegó protegido.",
    sizeLabel: "50 x 70 cm",
  },
  {
    nombre: "Gabriela",
    texto: "¡Me encantó! Siempre quise uno de Marilyn Monroe, la calidad es excelente. Llevo ya una semana con el cuadro. Gracias.",
    sizeLabel: "40 x 50 cm",
  },
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
