// Crea un registro de prueba en la LIST completed-orders (Redis), con
// purchasedAt ya "vencido" (6 días atrás) — para poder probar el cron
// de reseñas (/api/cron/send-review-emails) sin esperar 5 días reales.
// Uso puntual, no se integra a ningún flujo de la app.
//
// Uso: node scripts/create-test-completed-order.mjs
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
    process.env[match[1].trim()] = value;
  }
}

loadEnvLocal();

if (!process.env.REDIS_URL) {
  console.error("Falta REDIS_URL (revisa .env.local).");
  process.exit(1);
}

const COMPLETED_ORDERS_KEY = "completed-orders";
const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

const reference = `mystery-test-${Date.now()}`;

const record = {
  reference,
  customerEmail: "oscarmetacho@gmail.com",
  customerName: "Oscar (prueba)",
  productId: null,
  thumbnailUrl: "https://drive.google.com/thumbnail?id=test&sz=w1000",
  sizeLabel: "40 x 50 cm",
  purchasedAt: new Date(Date.now() - SIX_DAYS_MS).toISOString(),
  reviewEmailSentAt: null,
  reviewSubmittedAt: null,
};

const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000 });

try {
  await redis.rpush(COMPLETED_ORDERS_KEY, JSON.stringify(record));
  console.log("Registro de prueba creado:");
  console.log(JSON.stringify(record, null, 2));
  console.log(`\nreference de prueba: ${reference}`);
} finally {
  redis.disconnect();
}
