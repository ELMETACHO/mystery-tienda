// Lista TODOS los productos de catalog:products en Redis — de SOLO
// LECTURA, no borra ni modifica nada. Pensado para detectar a simple
// vista cuáles son el mismo diseño de prueba subido varias veces (en
// distintas categorías) antes de decidir cuáles borrar con otro script.
//
// Uso: node scripts/list-catalog-products.mjs
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

const CATALOG_KEY = "catalog:products";
const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000 });

try {
  const raw = await redis.lrange(CATALOG_KEY, 0, -1);
  const products = raw
    .map((entry, index) => {
      try {
        return { index, ...JSON.parse(entry) };
      } catch {
        return { index, parseError: true, raw: entry };
      }
    });

  console.log(`Total productos en ${CATALOG_KEY}: ${products.length}\n`);

  for (const p of products) {
    if (p.parseError) {
      console.log(`[${p.index}] ⚠ No se pudo parsear la entrada:`, p.raw);
      continue;
    }
    console.log(
      [
        `[${p.index}] id: ${p.id}`,
        `categoría: ${p.category}`,
        `subido: ${p.uploadedAt}`,
        `mockupFileId: ${p.mockupFileId || "—"}`,
        `originalRawFileId: ${p.originalRawFileId || "— (modelo viejo)"}`,
        `printFileIds: ${p.printFileIds ? JSON.stringify(p.printFileIds) : "— (modelo viejo)"}`,
        `salesCount: ${p.salesCount ?? "—"}`,
      ].join("\n    ")
    );
    console.log("");
  }
} finally {
  redis.disconnect();
}
