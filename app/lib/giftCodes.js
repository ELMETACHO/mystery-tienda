import Redis from "ioredis";

// Códigos de regalo (ej. para influencers): 100% de descuento, solo para
// 40x50, con un límite de USOS TOTALES (no de una sola vez) — a
// diferencia de discount.js (un código por correo) y referrals.js (sin
// límite de usos), acá el límite de veces que se puede canjear es el
// dato central, así que necesita su propio módulo en vez de reutilizar
// alguno de los otros dos.

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.on("error", (err) => {
      console.error("[giftCodes] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

// gift:<CODE> guarda el registro (JSON) — code, tamaño válido, máximo de
// usos y fecha de creación, todo fijo desde que se crea. gift:<CODE>:uses
// es un contador APARTE que solo sube con INCR (ver redeemGiftCode) — se
// separa del registro justo para poder incrementarlo de forma atómica;
// si el conteo de usos viviera dentro del mismo JSON, dos canjes
// simultáneos con un solo uso restante podrían leer el mismo valor antes
// de que ninguno escriba, y los dos pasarían la validación (el mismo
// problema de carrera que referral.js/discount.js aceptan porque ahí
// nunca es crítico pasarse por uno; acá si un código "de 3 usos" termina
// dándose 4 o 5 veces, eso sale directo del bolsillo del negocio).
function giftKey(code) {
  return `gift:${code.trim().toUpperCase()}`;
}
function giftUsesKey(code) {
  return `gift:${code.trim().toUpperCase()}:uses`;
}

export const GIFT_SIZE_ID = "40x50";
export const GIFT_DISCOUNT_PERCENT = 100;

// Nunca lanza silenciosamente: igual que createReferral, el código es el
// resultado principal que el admin está esperando ver en pantalla, así
// que un fallo real (Redis caído, no se logró un código único) debe
// distinguirse con un mensaje claro en vez de fallar en silencio.
export async function createGiftCode({ maxUses }) {
  const client = getRedisClient();
  if (!client) {
    throw new Error("REDIS_URL no está configurado.");
  }

  const uses = Number(maxUses);
  if (!Number.isInteger(uses) || uses < 1) {
    throw new Error("El número de usos debe ser un entero mayor a 0.");
  }

  let code = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `REGALO${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await client.exists(giftKey(candidate));
    if (!exists) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    throw new Error("No se pudo generar un código de regalo único.");
  }

  const record = {
    code,
    sizeId: GIFT_SIZE_ID,
    percent: GIFT_DISCOUNT_PERCENT,
    maxUses: uses,
    createdAt: new Date().toISOString(),
  };
  await client.set(giftKey(code), JSON.stringify(record));
  return { ...record, usedCount: 0, remainingUses: uses, active: true };
}

// Nunca lanza — un código inexistente y un fallo de Redis se tratan
// igual (null), el llamador decide qué mensaje mostrar.
export async function getGiftCode(code) {
  const client = getRedisClient();
  if (!client || !code) return null;

  try {
    const raw = await client.get(giftKey(code));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("[giftCodes] No se pudo leer el código de regalo:", err);
    return null;
  }
}

// Nunca lanza — usado por /api/validate-discount, donde un código de
// regalo inválido/agotado se trata igual que cualquier otro código
// inválido (mismo mensaje genérico, ver INVALID_MESSAGE ahí).
export async function validateGiftCode(code) {
  const client = getRedisClient();
  if (!client || !code) return { valid: false };

  try {
    const record = await getGiftCode(code);
    if (!record) return { valid: false };

    const usedCountRaw = await client.get(giftUsesKey(record.code));
    const usedCount = Number(usedCountRaw) || 0;
    if (usedCount >= record.maxUses) return { valid: false };

    return {
      valid: true,
      percent: record.percent,
      sizeId: record.sizeId,
      remainingUses: record.maxUses - usedCount,
    };
  } catch (err) {
    console.error("[giftCodes] No se pudo validar el código de regalo:", err);
    return { valid: false };
  }
}

// Consume un uso — INCR es atómico en Redis, así que dos canjes
// simultáneos nunca pueden "pasar" ambos con el último uso disponible
// (ver comentario de giftUsesKey arriba). Si el incremento se pasa del
// máximo, se revierte con DECR y esta redención se rechaza — el pedido
// que la llamó (confirmFreeOrder) ya revalidó el código justo antes con
// validateGiftCode, así que llegar hasta acá y de todos modos perder la
// carrera debería ser rarísimo, pero el código nunca debe terminar con
// más usos de los prometidos.
export async function redeemGiftCode(code) {
  const client = getRedisClient();
  if (!client || !code) return false;

  try {
    const record = await getGiftCode(code);
    if (!record) return false;

    const usesKey = giftUsesKey(record.code);
    const newCount = await client.incr(usesKey);
    if (newCount > record.maxUses) {
      await client.decr(usesKey);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[giftCodes] No se pudo redimir el código de regalo:", err);
    return false;
  }
}

// Para /admin/regalos: todos los códigos con sus usos restantes reales
// (calculados desde el contador atómico, nunca cacheados) — mismo patrón
// KEYS + lecturas individuales que getAllReferrals, razonable al volumen
// esperado de códigos de regalo. Nunca lanza.
export async function getAllGiftCodes() {
  const client = getRedisClient();
  if (!client) return [];

  try {
    const keys = await client.keys("gift:*");
    // Excluye las keys de contador (gift:<CODE>:uses) — no son JSON.
    const recordKeys = keys.filter((k) => !k.endsWith(":uses"));
    if (recordKeys.length === 0) return [];

    const rawValues = await client.mget(recordKeys);
    const records = rawValues
      .map((raw) => {
        try {
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const usedCounts = await Promise.all(
      records.map((r) => client.get(giftUsesKey(r.code)))
    );

    return records
      .map((r, i) => {
        const usedCount = Number(usedCounts[i]) || 0;
        return {
          ...r,
          usedCount,
          remainingUses: Math.max(r.maxUses - usedCount, 0),
          active: usedCount < r.maxUses,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (err) {
    console.error("[giftCodes] No se pudo listar los códigos de regalo:", err);
    return [];
  }
}
