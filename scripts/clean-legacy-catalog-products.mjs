// Borra de catalog:products los productos del modelo VIEJO (sin
// originalRawFileId/printFileIds del nuevo modelo pre-generado) — ver
// conversación sobre la migración a multi-tamaño. Uso puntual, no se
// integra a ningún flujo de la app.
//
// Uso: node scripts/clean-legacy-catalog-products.mjs
//   (por defecto solo MUESTRA qué borraría)
// Uso real: node scripts/clean-legacy-catalog-products.mjs --apply
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

const apply = process.argv.includes("--apply");
const CATALOG_KEY = "catalog:products";
const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000 });

function isLegacyProduct(product) {
  return !product.originalRawFileId || !product.printFileIds;
}

try {
  const raw = await redis.lrange(CATALOG_KEY, 0, -1);
  const products = raw
    .map((entry) => {
      try {
        return JSON.parse(entry);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const legacy = products.filter(isLegacyProduct);
  const keep = products.filter((p) => !isLegacyProduct(p));

  console.log(`Total productos: ${products.length}`);
  console.log(`Del modelo viejo (a borrar): ${legacy.length}`);
  for (const p of legacy) {
    console.log(`  - ${p.id} (categoría: ${p.category}, subido: ${p.uploadedAt})`);
  }
  console.log(`Se conservan (modelo nuevo): ${keep.length}`);

  if (!apply) {
    console.log("\nModo simulación — no se borró nada. Corre con --apply para aplicar de verdad.");
  } else if (legacy.length === 0) {
    console.log("\nNada que borrar.");
  } else {
    // Reescribe la lista completa dentro de una transacción: borra la key
    // y vuelve a insertar solo los productos que se conservan, en el
    // mismo orden — evita issues de índices moviéndose si se usara LREM
    // uno por uno mientras otros procesos leen la lista.
    const multi = redis.multi();
    multi.del(CATALOG_KEY);
    for (const p of keep) {
      multi.rpush(CATALOG_KEY, JSON.stringify(p));
    }
    await multi.exec();
    console.log(`\nListo: se borraron ${legacy.length} producto(s) viejo(s).`);
  }
} finally {
  redis.disconnect();
}
