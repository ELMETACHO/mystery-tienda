import Redis from "ioredis";

// Historial simple de pedidos por correo en Redis (Upstash, conectado en
// Vercel como integración "Redis"), para detectar clientes recurrentes.
// Requiere la variable de entorno REDIS_URL (connection string). Sin ella
// —por ejemplo en dev local si no se configuró— las funciones fallan de
// forma controlada y el pedido sigue su curso normal como si no fuera
// cliente recurrente.

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    // Sin este listener, un error de conexión emitido de forma asíncrona
    // por ioredis puede terminar como una excepción no capturada y tumbar
    // el proceso; con el listener, el error simplemente se loguea.
    redisClient.on("error", (err) => {
      console.error("[loyalty] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

function orderHistoryKey(email) {
  return `orders:${email.trim().toLowerCase()}`;
}

// Agrega el pedido actual al historial del correo (RPUSH) y devuelve si el
// cliente ya tenía al menos un pedido previo guardado (LLEN antes de
// agregar el nuevo). Nunca lanza: si Redis no está disponible o falla,
// retorna isReturningCustomer: false para no bloquear la confirmación del
// pago.
export async function recordOrderAndCheckReturning({
  email,
  reference,
  amountCOP,
  trackingNumber,
  carrierName,
  shipmentError,
}) {
  const client = getRedisClient();
  if (!client) {
    console.error(
      "[loyalty] REDIS_URL no está configurado; se omite el registro en Redis."
    );
    return false;
  }

  try {
    const key = orderHistoryKey(email);
    const previousOrderCount = await client.llen(key);
    const isReturningCustomer = previousOrderCount > 0;

    const record = JSON.stringify({
      reference,
      date: new Date().toISOString(),
      amountCOP,
      // Solo presentes en pedidos contraentrega con guía generada por
      // Skydropx; undefined se omite naturalmente al serializar a JSON.
      trackingNumber,
      carrierName,
      // Mensaje de error EXACTO (no solo un booleano) cuando la guía
      // automática falló, para poder diagnosticar sin ir a buscar en los
      // logs de Vercel cada vez — ver app/api/confirm-cod-order/route.js.
      shipmentError,
    });
    await client.rpush(key, record);

    return isReturningCustomer;
  } catch (err) {
    console.error("[loyalty] No se pudo acceder a Redis:", err);
    return false;
  }
}

// Cuántos pedidos previos tiene un correo — usado para la columna "Total
// histórico de compras" del CRM (ver manufacturerFinance.js). Se llama
// DESPUÉS de recordOrderAndCheckReturning, así que ya incluye el pedido
// recién confirmado. Nunca lanza: si Redis falla, se reporta 1 (el
// pedido actual) como piso seguro en vez de bloquear el registro CRM.
export async function getOrderCount(email) {
  const client = getRedisClient();
  if (!client) return 1;

  try {
    const count = await client.llen(orderHistoryKey(email));
    return count || 1;
  } catch (err) {
    console.error("[loyalty] No se pudo contar el historial:", err);
    return 1;
  }
}

// Usado por /api/validate-discount: un código de descuento nunca es
// canjeable por un correo sin compras registradas — ni siquiera si por
// algún motivo hubiera quedado un registro en discount:<email> (no
// debería pasar, ver grantDiscountCode en discount.js, pero se
// revalida acá para no depender solo de esa garantía). Nunca lanza: un
// fallo de Redis simplemente hace que el código se trate como inválido.
export async function hasPreviousOrders(email) {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const count = await client.llen(orderHistoryKey(email));
    return count > 0;
  } catch (err) {
    console.error("[loyalty] No se pudo verificar el historial:", err);
    return false;
  }
}
