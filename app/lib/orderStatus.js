import Redis from "ioredis";
import { getManualShipmentRequest } from "./manualShipments";
import { addBusinessDays, DELIVERY_MAX_BUSINESS_DAYS, DELIVERY_MIN_BUSINESS_DAYS, todayInBogota } from "./deliveryEstimate";

// Consulta pública de estado de pedido (/pedido). Lee el MISMO registro que
// ya usa el fabricante para generar la guía (manual-shipment:{reference},
// ver app/lib/manualShipments.js — vive 30 días desde el pago). Solo
// lectura: nunca modifica el pedido.
//
// Reglas de privacidad:
//  - Solo se responde si coinciden la referencia Y el celular (últimos 4
//    dígitos o número completo). Si algo no coincide, la respuesta es la
//    misma que si la referencia no existiera (no se puede averiguar si una
//    referencia es real).
//  - Nunca se devuelve nombre, dirección, correo, teléfono ni el PDF de la
//    guía (trae la dirección) — solo estado, tamaño, transportadora,
//    número de guía y link de rastreo de la transportadora.
//  - Tope de intentos fallidos POR REFERENCIA (además del límite por IP en
//    la ruta): con 4 dígitos hay 10.000 combinaciones; 5 fallos por hora
//    hacen inviable adivinar.

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 3000 });
    redisClient.on("error", (err) => {
      console.error("[orderStatus] Error de conexión a Redis:", err);
    });
  }
  return redisClient;
}

export const MAX_FAILED_ATTEMPTS_PER_REFERENCE = 5;
const FAILED_ATTEMPTS_WINDOW_SECONDS = 60 * 60;

const REFERENCE_PATTERN = /^[a-z0-9][a-z0-9-]{5,79}$/i;

export function normalizeReference(value) {
  const ref = String(value || "").trim();
  return REFERENCE_PATTERN.test(ref) ? ref : null;
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

// Acepta exactamente los últimos 4 dígitos, o el número completo (10+
// dígitos, con o sin +57). Cualquier otro largo no es válido.
export function normalizePhoneInput(value) {
  const d = digits(value);
  if (d.length === 4) return { kind: "last4", value: d };
  if (d.length >= 10 && d.length <= 15) return { kind: "full", value: d.slice(-10) };
  return null;
}

export function phoneMatches(recordPhone, phoneInput) {
  const rec = digits(recordPhone);
  if (!phoneInput || rec.length < 4) return false;
  if (phoneInput.kind === "last4") return rec.slice(-4) === phoneInput.value;
  return rec.length >= 10 && rec.slice(-10) === phoneInput.value;
}

function failedKey(reference) {
  return `order-status-failed:${reference.toLowerCase()}`;
}

export async function isReferenceLocked(reference) {
  const client = getRedisClient();
  if (!client) return false;
  try {
    const count = Number(await client.get(failedKey(reference))) || 0;
    return count >= MAX_FAILED_ATTEMPTS_PER_REFERENCE;
  } catch (err) {
    console.error("[orderStatus] No se pudo leer intentos fallidos:", err);
    return false;
  }
}

export async function registerFailedLookup(reference) {
  const client = getRedisClient();
  if (!client) return;
  try {
    const key = failedKey(reference);
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, FAILED_ATTEMPTS_WINDOW_SECONDS);
  } catch (err) {
    console.error("[orderStatus] No se pudo registrar intento fallido:", err);
  }
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isoDay(value) {
  const t = Date.parse(value || "");
  return Number.isFinite(t) ? todayInBogota(t) : null;
}

// Solo los campos que se pueden mostrar públicamente.
export function toPublicStatus(record) {
  const order = record.order || {};
  const receivedDay = isoDay(record.savedAt);
  let stage = "produccion";
  if (record.status === "generated" && record.trackingNumber) stage = "despachado";
  else if (record.status === "no_coverage") stage = "sin_cobertura";

  return {
    stage,
    sizeLabel: order.sizeLabel || null,
    frameLabel: order.frameType === "tradicional" ? "Tradicional" : "Premium",
    receivedAt: record.savedAt || null,
    shippedAt: stage === "despachado" ? record.generatedAt || null : null,
    carrierName: stage === "despachado" ? record.carrierName || null : null,
    trackingNumber: stage === "despachado" ? record.trackingNumber || null : null,
    trackingUrl: stage === "despachado" ? safeHttpUrl(record.trackingUrl) : null,
    isCod: record.paymentMethod === "cod",
    saldoPendienteCOP: record.paymentMethod === "cod" ? Number(record.saldoPendiente) || 0 : 0,
    // Misma regla que la fecha estimada de la tienda (2.º a 5.º día hábil
    // desde el día del pedido, sin domingos ni festivos).
    estimatedFrom: receivedDay ? addBusinessDays(receivedDay, DELIVERY_MIN_BUSINESS_DAYS) : null,
    estimatedTo: receivedDay ? addBusinessDays(receivedDay, DELIVERY_MAX_BUSINESS_DAYS) : null,
  };
}

// Devuelve { status } si referencia + celular coinciden, { locked: true }
// si la referencia tiene demasiados intentos fallidos, o { notFound: true }.
export async function lookupOrderStatus({ reference, phoneInput }) {
  if (await isReferenceLocked(reference)) return { locked: true };

  const record = await getManualShipmentRequest(reference);
  if (!record || !phoneMatches(record.customer?.phone, phoneInput)) {
    await registerFailedLookup(reference);
    return { notFound: true };
  }
  return { status: toPublicStatus(record) };
}
