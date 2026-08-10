import Redis from "ioredis";

// Guarda de idempotencia para no procesar dos veces la misma
// transacción de Wompi: el cliente (si regresa a la pestaña) y el
// webhook (/api/wompi-webhook) pueden llegar a confirmar el MISMO pago
// — sin esto, ambos caminos enviarían los correos por separado.

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.on("error", (err) => {
      console.error("[idempotency] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

function confirmedTxKey(transactionId) {
  return `confirmed-tx:${transactionId}`;
}

// 30 días: más que suficiente para cubrir cualquier reintento real de
// Wompi (máximo 24h) con margen amplio, sin acumular estas keys para
// siempre.
const CONFIRMED_TX_TTL_SECONDS = 60 * 60 * 24 * 30;

// SET ... NX: solo UNA llamada concurrente puede "reclamar" un
// transactionId — devuelve true si esta llamada fue la primera (debe
// procesar el pedido), false si ya estaba reclamado (otro camino ya lo
// procesó o lo está procesando, no hacer nada).
//
// Si Redis no está disponible, se OPTA por dejar procesar de todas
// formas (retorna true) en vez de bloquear la confirmación de un pago
// real por un problema de infraestructura — el peor caso posible es un
// correo duplicado, no un pedido pagado sin confirmar.
export async function claimTransaction(transactionId) {
  const client = getRedisClient();
  if (!client) {
    console.error("[idempotency] REDIS_URL no está configurado; no se puede garantizar idempotencia.");
    return true;
  }

  try {
    const result = await client.set(
      confirmedTxKey(transactionId),
      "1",
      "EX",
      CONFIRMED_TX_TTL_SECONDS,
      "NX"
    );
    return result === "OK";
  } catch (err) {
    console.error("[idempotency] No se pudo reclamar la transacción:", err);
    return true;
  }
}

// Libera el reclamo (DEL) si el procesamiento posterior falló (ej. el
// envío de correos) — así un reintento legítimo (del cliente o del
// webhook) puede volver a intentarlo, en vez de quedar marcado como
// "ya procesado" para siempre sin que en realidad se haya completado.
export async function releaseTransactionClaim(transactionId) {
  const client = getRedisClient();
  if (!client) return;

  try {
    await client.del(confirmedTxKey(transactionId));
  } catch (err) {
    console.error("[idempotency] No se pudo liberar el reclamo de la transacción:", err);
  }
}
