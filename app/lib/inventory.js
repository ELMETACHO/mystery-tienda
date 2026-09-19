import Redis from "ioredis";
import { sendLowStockEmail } from "./email";

// Inventario de cuadros físicos (ya impresos/armados) y soportes dentados.
// Un cuadro Premium consume 1 unidad de `${sizeId}:premium`; uno Tradicional
// consume 1 de `${sizeId}:tradicional` + 1 "soportes" (todos los
// tradicionales llevan un soporte dentado sin importar el tamaño).
//
// Redis: hash `inventory:stock` (campo → unidades) y hash
// `inventory:thresholds` (campo → umbral de alerta). Un campo que no existe
// en el hash de stock no se rastrea (ej. 50x70) — nunca se descuenta.

const STOCK_KEY = "inventory:stock";
const THRESHOLDS_KEY = "inventory:thresholds";
const META_KEY = "inventory:meta"; // campo -> ultima actualizacion (quien/cuando/que)
const LOG_KEY = "inventory:log"; // historial reciente, mas nuevo primero
const LOG_MAX = 50;
const APPLIED_TTL_SECONDS = 60 * 60 * 24 * 90;

export const SUPPORTS_FIELD = "soportes";

const INITIAL_STOCK = {
  "40x50:premium": 12,
  "40x50:tradicional": 11,
  "30x40:premium": 6,
  "30x40:tradicional": 5,
  [SUPPORTS_FIELD]: 15,
};

const DEFAULT_THRESHOLD_FRAME = 3;
const DEFAULT_THRESHOLD_SUPPORTS = 5;

export function fieldLabel(field) {
  if (field === SUPPORTS_FIELD) return "Soportes dentados";
  const [size, type] = field.split(":");
  return `${size} ${type === "premium" ? "Premium" : "Tradicional"}`;
}

function defaultThreshold(field) {
  return field === SUPPORTS_FIELD ? DEFAULT_THRESHOLD_SUPPORTS : DEFAULT_THRESHOLD_FRAME;
}

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.on("error", (err) => {
      console.error("[inventory] Error de conexión a Redis:", err);
    });
  }
  return redisClient;
}

// Registra quien hizo el cambio, cuando y que — siempre, sin excepcion.
async function recordChange(client, field, by, note) {
  const entry = { field, label: fieldLabel(field), by, at: new Date().toISOString(), note };
  await client.hset(META_KEY, field, JSON.stringify(entry));
  await client.lpush(LOG_KEY, JSON.stringify(entry));
  await client.ltrim(LOG_KEY, 0, LOG_MAX - 1);
}

// Siembra el stock inicial solo la primera vez (HSETNX no pisa lo existente).
async function ensureSeeded(client) {
  const exists = await client.exists(STOCK_KEY);
  if (exists) return;
  for (const [field, qty] of Object.entries(INITIAL_STOCK)) {
    await client.hsetnx(STOCK_KEY, field, qty);
  }
}

export async function getInventory() {
  const client = getRedisClient();
  if (!client) return [];
  try {
    await ensureSeeded(client);
    const [stock, thresholds, meta] = await Promise.all([
      client.hgetall(STOCK_KEY),
      client.hgetall(THRESHOLDS_KEY),
      client.hgetall(META_KEY),
    ]);
    return Object.entries(stock)
      .map(([field, qty]) => {
        const quantity = Number(qty);
        const threshold = thresholds[field] != null ? Number(thresholds[field]) : defaultThreshold(field);
        return {
          field,
          label: fieldLabel(field),
          quantity,
          threshold,
          low: quantity <= threshold,
          lastUpdate: meta[field] ? JSON.parse(meta[field]) : null,
        };
      })
      .sort((a, b) => a.field.localeCompare(b.field));
  } catch (err) {
    console.error("[inventory] No se pudo leer el inventario:", err);
    return [];
  }
}

export async function getInventoryLog(limit = 10) {
  const client = getRedisClient();
  if (!client) return [];
  try {
    return (await client.lrange(LOG_KEY, 0, limit - 1)).map((l) => JSON.parse(l));
  } catch (err) {
    console.error("[inventory] No se pudo leer el historial:", err);
    return [];
  }
}

// Ajuste manual desde el panel: `set` fija la cantidad exacta, `add` suma
// (reposición). Solo campos ya conocidos o de la forma "NNxNN:tipo".
export async function updateInventory({ field, set, add, threshold, by }) {
  const client = getRedisClient();
  if (!client) return false;
  if (field !== SUPPORTS_FIELD && !/^\d{2}x\d{2}:(premium|tradicional)$/.test(field)) return false;
  try {
    await ensureSeeded(client);
    const who = by || "Desconocido";
    if (Number.isFinite(set)) {
      await client.hset(STOCK_KEY, field, Math.trunc(set));
      await recordChange(client, field, who, `Corrigió la cantidad a ${Math.trunc(set)}`);
    }
    if (Number.isFinite(add)) {
      const n = Math.trunc(add);
      const now = await client.hincrby(STOCK_KEY, field, n);
      await recordChange(client, field, who, `${n >= 0 ? "Repuso +" : "Restó "}${n} (quedan ${now})`);
    }
    if (Number.isFinite(threshold)) {
      const t = Math.max(0, Math.trunc(threshold));
      await client.hset(THRESHOLDS_KEY, field, t);
      await recordChange(client, field, who, `Cambió el umbral de alerta a ${t}`);
    }
    return true;
  } catch (err) {
    console.error("[inventory] No se pudo actualizar el inventario:", err);
    return false;
  }
}

// Llamado al confirmar una venta real. Idempotente por `reference` y nunca
// lanza — un fallo de inventario jamás debe romper la confirmación de un
// pedido ya pagado.
export async function consumeStockForOrder({ order, reference }) {
  try {
    const client = getRedisClient();
    if (!client || !order?.sizeId) return;

    const claimed = await client.set(`inventory:applied:${reference}`, "1", "EX", APPLIED_TTL_SECONDS, "NX");
    if (!claimed) return;

    await ensureSeeded(client);
    const type = order.frameType === "tradicional" ? "tradicional" : "premium";
    const fields = [`${order.sizeId}:${type}`];
    if (type === "tradicional") fields.push(SUPPORTS_FIELD);

    const thresholds = await client.hgetall(THRESHOLDS_KEY);
    const lowItems = [];

    for (const field of fields) {
      if (!(await client.hexists(STOCK_KEY, field))) continue; // no rastreado
      const after = await client.hincrby(STOCK_KEY, field, -1);
      await recordChange(client, field, "Venta automática", `Pedido ${reference} (quedan ${after})`);
      const threshold = thresholds[field] != null ? Number(thresholds[field]) : defaultThreshold(field);
      // Alerta solo al CRUZAR el umbral (o al llegar a 0), no en cada venta.
      if (after === threshold || after === 0 || after === -1) {
        lowItems.push({ label: fieldLabel(field), quantity: after });
      }
    }

    if (lowItems.length) {
      await sendLowStockEmail(lowItems);
    }
  } catch (err) {
    console.error("[inventory] Falló el descuento de stock:", err);
  }
}
