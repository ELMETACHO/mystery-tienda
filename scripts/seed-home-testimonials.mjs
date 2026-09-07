// Siembra home:testimonials con testimonios de MUESTRA mientras llegan
// reseñas reales suficientes (el cron semanal, ver
// app/api/cron/select-home-testimonials/route.js, los reemplaza solo en
// cuanto haya 4+ reseñas reales calificadas). Usa las fotos de pared
// genéricas de public/images/page-ads (PARED1/2/3.png) en vez de fotos de
// cuadros específicos, porque estos testimonios no corresponden a un
// pedido real.
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

const SAMPLE_TESTIMONIALS = [
  {
    nombre: "Valentina O.",
    texto:
      "Le regalé a mi mamá un cuadro con la foto de mi hijo y casi llora cuando lo abrió. La calidad quedó muy bien, se ve mejor de lo que pensé en la pantalla.",
    sizeLabel: "40 x 50 cm",
    foto: "/images/page-ads/PARED1.png",
    rating: 5,
  },
  {
    nombre: "Juan David P.",
    texto:
      "Pedí uno de mi perro que ya no está con nosotros. Todo el proceso fue fácil desde el celular y llegó en menos de una semana. Gracias por el detalle.",
    sizeLabel: "30 x 40 cm",
    foto: "/images/page-ads/PARED2.png",
    rating: 5,
  },
  {
    nombre: "Mariana T.",
    texto:
      "Quedé indecisa entre dos fotos pero al final el resultado me gustó mucho, se ve profesional en la pared de la sala. Sí recomiendo el tamaño grande si tienen espacio.",
    sizeLabel: "50 x 70 cm",
    foto: "/images/page-ads/PARED3.png",
    rating: 5,
  },
  {
    nombre: "Sebastián R.",
    texto:
      "Tenía dudas por la resolución de mi foto pero me escribieron avisando y quedó bien igual. Buena atención, contestan rápido por WhatsApp.",
    sizeLabel: "40 x 50 cm",
    foto: "/images/page-ads/PARED1.png",
    rating: 4,
  },
  {
    nombre: "Camila A.",
    texto:
      "Es la segunda vez que compro, esta vez para regalar. El empaque llegó bien cuidado y el marco se ve más grueso de lo que esperaba, en el buen sentido.",
    sizeLabel: "30 x 40 cm",
    foto: "/images/page-ads/PARED2.png",
    rating: 5,
  },
];

const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000 });

try {
  const existingRaw = await redis.get(HOME_TESTIMONIALS_KEY);
  if (existingRaw) {
    console.log(
      "Ya hay una selección guardada en home:testimonials. Si quieres reemplazarla de todas formas, borra la key en Redis primero."
    );
    process.exit(0);
  }

  await redis.set(HOME_TESTIMONIALS_KEY, JSON.stringify(SAMPLE_TESTIMONIALS));
  console.log(`Listo — ${SAMPLE_TESTIMONIALS.length} testimonios de muestra guardados en ${HOME_TESTIMONIALS_KEY}.`);
} finally {
  redis.disconnect();
}
