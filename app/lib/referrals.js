import Redis from "ioredis";

// Programa de referidos ("embajadores Mystery") — cada persona que se
// inscribe en /referidos recibe un código propio, lo comparte, y cuando
// alguien compra usándolo en el campo de código del checkout (mismo
// campo que MYSTERY10, ver app/lib/discount.js) se le acredita una
// comisión. Mismo patrón de conexión Redis que el resto de app/lib/*.js.

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.on("error", (err) => {
      console.error("[referrals] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

function referralKey(code) {
  return `referral:${code.trim().toUpperCase()}`;
}

// Código simple y memorable: primer nombre (sin tildes/espacios, hasta 8
// letras) + 4 dígitos aleatorios — ej. "OSCAR4821". No es secreto (se
// comparte a propósito), así que no necesita ser críptico, solo único.
function buildCandidateCode(name) {
  const base =
    String(name || "")
      .normalize("NFD")
      // .normalize("NFD") separa cada tilde en su propio carácter
      // "combinante" (fuera de a-zA-Z) — este mismo filtro ya los
      // descarta junto con espacios/números, sin necesitar un regex
      // Unicode aparte para diacríticos.
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 8)
      .toUpperCase() || "MYSTERY";
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${base}${digits}`;
}

// Nunca lanza silenciosamente sin razón clara: si Redis no está
// configurado o no se logra un código único, lanza un error explícito —
// a diferencia de loyalty.js/discount.js (donde fallar es "seguir sin
// ese extra"), acá SÍ es el resultado principal que la persona está
// esperando ver en pantalla, así que /api/create-referral necesita
// distinguir el fallo real para mostrar un mensaje claro.
export async function createReferral({ name, whatsapp }) {
  const client = getRedisClient();
  if (!client) {
    throw new Error("REDIS_URL no está configurado.");
  }

  let code = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = buildCandidateCode(name);
    const exists = await client.exists(referralKey(candidate));
    if (!exists) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    throw new Error("No se pudo generar un código de referido único.");
  }

  const record = {
    code,
    name,
    whatsapp,
    createdAt: new Date().toISOString(),
    totalSales: 0,
    totalCommission: 0,
    orders: [],
  };
  await client.set(referralKey(code), JSON.stringify(record));
  return record;
}

// Nunca lanza — un fallo de Redis o un código inexistente se tratan
// igual (null), el llamador decide qué mensaje mostrar.
export async function getReferral(code) {
  const client = getRedisClient();
  if (!client || !code) return null;

  try {
    const raw = await client.get(referralKey(code));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("[referrals] No se pudo leer el referido:", err);
    return null;
  }
}

// Descuento que recibe el COMPRADOR al usar un código de referido —
// mismo mecanismo que MYSTERY10 (ver app/lib/discount.js y
// /api/validate-discount), aplicado también acá desde que se decidió
// que los códigos de referido ya no son "invisibles" para el
// comprador.
export const REFERRAL_DISCOUNT_PERCENT = 5;

// Comisión fija por tamaño — independiente del precio de venta (no un
// porcentaje), así que el 5% de descuento en la misma compra nunca
// reduce lo que gana el referido.
const COMMISSION_BY_SIZE_ID = {
  "30x40": 7000,
  "40x50": 10000,
  "50x70": 13000,
};

// Nunca lanza: acreditar la comisión es un "extra" sobre el pedido ya
// confirmado, mismo principio que loyalty.js/completedOrders.js — si el
// código no existe o Redis falla, el pedido sigue su curso igual, solo
// sin registrar la venta. Devuelve false en cualquier caso donde no se
// acreditó nada, para que el llamador pueda loguearlo si quiere.
export async function recordReferralSale({ code, sizeId }) {
  const client = getRedisClient();
  if (!client || !code) return false;

  const commission = COMMISSION_BY_SIZE_ID[sizeId];
  if (!commission) {
    console.error(`[referrals] Tamaño desconocido para comisión: ${sizeId}`);
    return false;
  }

  try {
    const key = referralKey(code);
    const raw = await client.get(key);
    if (!raw) {
      console.error(`[referrals] Código de referido no encontrado: ${code}`);
      return false;
    }

    const record = JSON.parse(raw);
    record.totalSales = (record.totalSales || 0) + 1;
    record.totalCommission = (record.totalCommission || 0) + commission;
    record.orders = [
      ...(record.orders || []),
      // Solo lo necesario para el panel del referido — nunca datos del
      // comprador (ni nombre, ni correo, ni dirección).
      { date: new Date().toISOString(), sizeId, commission },
    ];
    await client.set(key, JSON.stringify(record));
    return true;
  } catch (err) {
    console.error("[referrals] No se pudo registrar la venta:", err);
    return false;
  }
}

// Cada referido vive en su propia key (referral:<code>), no en una
// LIST como completedOrders.js/catalog.js — necesario para que
// getReferral() sea O(1) por código. Para el panel de administrador
// (el único lugar que necesita ver TODOS los referidos a la vez) se
// usa KEYS + lecturas individuales; al volumen esperado de embajadores
// esto es razonable (mismo criterio que otros escaneos puntuales del
// proyecto). Nunca lanza — un fallo de Redis devuelve lista vacía.
export async function getAllReferrals() {
  const client = getRedisClient();
  if (!client) return [];

  try {
    const keys = await client.keys("referral:*");
    if (keys.length === 0) return [];

    const rawValues = await client.mget(keys);
    return rawValues
      .map((raw) => {
        try {
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    console.error("[referrals] No se pudo listar los referidos:", err);
    return [];
  }
}

// Marca el saldo de un referido como pagado: reinicia totalCommission a
// 0 SIN tocar totalSales ni el historial de orders (esos siguen siendo
// el registro histórico real de ventas, independiente de si ya se le
// pagó o no). Nunca lanza.
export async function resetReferralCommission(code) {
  const client = getRedisClient();
  if (!client || !code) return false;

  try {
    const key = referralKey(code);
    const raw = await client.get(key);
    if (!raw) return false;

    const record = JSON.parse(raw);
    record.totalCommission = 0;
    await client.set(key, JSON.stringify(record));
    return true;
  } catch (err) {
    console.error("[referrals] No se pudo reiniciar la comisión:", err);
    return false;
  }
}
