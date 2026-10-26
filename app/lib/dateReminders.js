import Redis from "ioredis";
import { createHmac, timingSafeEqual } from "crypto";

// Recordatorio de fechas especiales (oct 2026, área de Conversión): un
// cuadro se compra pocas veces al año, así que la forma de que el cliente
// vuelva es avisarle antes de la PRÓXIMA fecha para la que compra regalo
// (cumpleaños, aniversario, Día de la Madre…). En la confirmación el
// cliente elige, si quiere, la ocasión y el día; 14 días antes de esa
// fecha (el año siguiente) le llega UN correo. Nada más.
//
// - Opt-in explícito (Ley 1581): solo se guarda si el cliente lo pide, y
//   cada correo trae un link para cancelarlo.
// - Nunca se confía en el navegador para el correo de destino: se guarda
//   solo la referencia del pedido y, al enviar, el correo sale del registro
//   real del pedido (completed-orders). Una referencia inventada nunca
//   genera un envío.
// - Nunca lanza hacia la página de confirmación: si Redis falla, el
//   cliente ve un mensaje amable y el pedido no se entera.

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.on("error", (err) => {
      console.error("[dateReminders] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

// HASH: campo = referencia del pedido, valor = JSON del recordatorio.
const DATE_REMINDERS_KEY = "date-reminders";

export const REMINDER_DAYS_BEFORE = 14;

export const OCCASIONS = {
  cumpleanos: "Cumpleaños",
  aniversario: "Aniversario",
  madre: "Día de la Madre",
  padre: "Día del Padre",
  amor_amistad: "Amor y Amistad",
  navidad: "Navidad",
  otra: "Fecha especial",
};

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Valida lo que llega del navegador. Devuelve el recordatorio limpio o null.
export function normalizeReminderInput({ occasion, month, day, forName } = {}) {
  const m = Number(month);
  const d = Number(day);
  if (!OCCASIONS[occasion]) return null;
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  if (!Number.isInteger(d) || d < 1 || d > DAYS_IN_MONTH[m - 1]) return null;
  const name = String(forName || "")
    .replace(/[<>\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 40);
  return { occasion, month: m, day: d, forName: name || null };
}

// "AAAA-MM-DD" de hoy en Colombia (UTC-5, sin horario de verano).
export function todayInColombia(now = Date.now()) {
  return new Date(now - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isoDate(year, month, day) {
  // 29 de febrero en año no bisiesto → 28 de febrero.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const t = new Date(`${iso}T00:00:00Z`).getTime() + days * 24 * 60 * 60 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

// Una ocurrencia que cae dentro de los ~6 meses siguientes a la compra se
// considera la fecha para la que YA compró este regalo: no se le avisa
// para esa, sino para la del año siguiente.
const SAME_GIFT_WINDOW_DAYS = 180;

// ¿Toca enviar hoy? Sí cuando hoy cae dentro de los 14 días previos a la
// próxima ocurrencia de la fecha, no se ha enviado para esa ocurrencia y
// no es la fecha del regalo que acaba de comprar. Se usa una ventana (y
// no "hoy == 14 días antes") para que un día sin cron no haga perder el
// aviso. Devuelve la fecha de la ocasión ("AAAA-MM-DD") o null.
export function dueOccurrence(reminder, today = todayInColombia()) {
  const year = Number(today.slice(0, 4));
  const createdDay = String(reminder.createdAt || "").slice(0, 10);
  for (const y of [year, year + 1]) {
    const occurrence = isoDate(y, reminder.month, reminder.day);
    if (occurrence < today) continue;
    if (createdDay && occurrence < addDays(createdDay, SAME_GIFT_WINDOW_DAYS)) continue;
    const windowStart = addDays(occurrence, -REMINDER_DAYS_BEFORE);
    if (today < windowStart) return null;
    if (reminder.lastSentFor === occurrence) return null;
    return occurrence;
  }
  return null;
}

// Token del link "No quiero más recordatorios" — mismo esquema HMAC sin
// estado que el link de reseña (reviewToken.js), con otro prefijo para
// que un token de reseña no sirva para esto.
function getSecret() {
  const secret = process.env.REVIEW_TOKEN_SECRET;
  if (!secret) throw new Error("Falta REVIEW_TOKEN_SECRET en las variables de entorno.");
  return secret;
}

export function generateReminderCancelToken(reference) {
  return createHmac("sha256", getSecret()).update(`date-reminder:${reference}`).digest("base64url");
}

export function isValidReminderCancelToken(reference, token) {
  if (!reference || !token) return false;
  let expected;
  try {
    expected = generateReminderCancelToken(reference);
  } catch (err) {
    console.error("[dateReminders] No se pudo generar el token esperado:", err);
    return false;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(String(token));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function saveDateReminder(reference, input) {
  const client = getRedisClient();
  if (!client) return false;
  try {
    const record = { reference, ...input, createdAt: new Date().toISOString(), lastSentFor: null };
    await client.hset(DATE_REMINDERS_KEY, reference, JSON.stringify(record));
    return true;
  } catch (err) {
    console.error("[dateReminders] No se pudo guardar:", err);
    return false;
  }
}

export async function deleteDateReminder(reference) {
  const client = getRedisClient();
  if (!client) return false;
  try {
    await client.hdel(DATE_REMINDERS_KEY, reference);
    return true;
  } catch (err) {
    console.error("[dateReminders] No se pudo borrar:", err);
    return false;
  }
}

export async function getAllDateReminders() {
  const client = getRedisClient();
  if (!client) return [];
  try {
    const raw = await client.hgetall(DATE_REMINDERS_KEY);
    return Object.values(raw || {})
      .map((v) => {
        try {
          return JSON.parse(v);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    console.error("[dateReminders] No se pudieron leer:", err);
    return [];
  }
}

export async function markDateReminderSent(reference, occurrence) {
  const client = getRedisClient();
  if (!client) return false;
  try {
    const raw = await client.hget(DATE_REMINDERS_KEY, reference);
    if (!raw) return false;
    const record = { ...JSON.parse(raw), lastSentFor: occurrence, lastSentAt: new Date().toISOString() };
    await client.hset(DATE_REMINDERS_KEY, reference, JSON.stringify(record));
    return true;
  } catch (err) {
    console.error("[dateReminders] No se pudo marcar como enviado:", err);
    return false;
  }
}
