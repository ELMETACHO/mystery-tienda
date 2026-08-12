import Redis from "ioredis";

// Código de descuento MYSTERY10 para clientes recurrentes — canjeable de
// verdad (antes solo se mostraba en /checkout/confirmacion sin lógica de
// canje real). Se guarda en Redis por correo (mismo patrón que
// loyalty.js), nunca por código suelto: eso es justamente lo que evita
// que sea compartible — ver validateDiscountCode, que solo busca bajo el
// correo que el cliente escribe en el checkout.

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.on("error", (err) => {
      console.error("[discount] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

const MYSTERY10_CODE = "MYSTERY10";
const MYSTERY10_PERCENT = 10;

function discountKey(email) {
  return `discount:${email.trim().toLowerCase()}`;
}

// Nunca lanza: otorgar el código es un "extra" del programa de fidelidad,
// no debe poder tumbar la confirmación de un pago real si Redis falla —
// mismo principio que loyalty.js/completedOrders.js. Si el cliente ya
// tiene un código guardado (usado o no), no se sobreescribe: nunca se
// debe re-otorgar ni "revivir" uno ya canjeado en una compra posterior.
export async function grantDiscountCode(email) {
  const client = getRedisClient();
  if (!client) {
    console.error("[discount] REDIS_URL no está configurado; no se otorgó el código.");
    return false;
  }

  try {
    const key = discountKey(email);
    const existing = await client.get(key);
    if (existing) return false;

    const record = {
      code: MYSTERY10_CODE,
      percent: MYSTERY10_PERCENT,
      used: false,
      createdAt: new Date().toISOString(),
      usedAt: null,
    };
    await client.set(key, JSON.stringify(record));
    return true;
  } catch (err) {
    console.error("[discount] No se pudo otorgar el código:", err);
    return false;
  }
}

// Nunca lanza — un fallo de Redis simplemente hace que el código se trate
// como inválido (no bloquea que el cliente pague el precio normal, ver
// /api/validate-discount).
export async function validateDiscountCode({ email, code }) {
  const client = getRedisClient();
  if (!client) return { valid: false };

  try {
    const raw = await client.get(discountKey(email));
    if (!raw) return { valid: false };

    const record = JSON.parse(raw);
    if (record.used || record.code !== code) return { valid: false };

    return { valid: true, percent: record.percent || MYSTERY10_PERCENT };
  } catch (err) {
    console.error("[discount] No se pudo validar el código:", err);
    return { valid: false };
  }
}

// Nunca lanza: si esto falla, el pedido ya se confirmó igual (ver
// confirmApprovedOrder.js / confirm-cod-order/route.js) — el único efecto
// es que el código quedaría reutilizable; se loguea fuerte para revisar
// a mano. Vuelve a comprobar code/used antes de marcar (nunca confía en
// que el estado que trae el pedido siga siendo válido al momento del
// pago).
export async function markDiscountUsed(email, code) {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const key = discountKey(email);
    const raw = await client.get(key);
    if (!raw) return false;

    const record = JSON.parse(raw);
    if (record.code !== code || record.used) return false;

    record.used = true;
    record.usedAt = new Date().toISOString();
    await client.set(key, JSON.stringify(record));
    return true;
  } catch (err) {
    console.error("[discount] No se pudo marcar el código como usado:", err);
    return false;
  }
}
