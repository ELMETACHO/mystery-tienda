import Redis from "ioredis";

// "Seguro" de emergencia: copia de cada pedido YA PAGADO (con la imagen de
// impresión) que vive 1 año — a diferencia del pending-order (2 días, ver
// pendingOrders.js) y del manual-shipment (30 días, sin imagen). Si algo
// falla en la cadena normal de confirmación, con esto siempre se puede
// rearmar el pedido a mano. Solo se guarda printImage (la de impresión); la
// miniatura del cliente (croppedImage) no hace falta y duplicaría el peso.
let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 3000 });
    redisClient.on("error", (err) => console.error("[paidBackup] Error de conexión a Redis:", err));
  }
  return redisClient;
}

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Nunca lanza. Pensado para llamarse dentro de after() — jamás en el camino
// crítico del cliente.
export async function savePaidOrderBackup({ reference, order, customer, paymentMethod, transactionId }) {
  try {
    const client = getRedisClient();
    if (!client) return false;
    const { croppedImage, ...orderWithoutThumb } = order || {};
    await client.set(
      `paid-backup:${reference}`,
      JSON.stringify({
        reference,
        transactionId,
        paymentMethod,
        order: { ...orderWithoutThumb, croppedImage: order?.productId ? croppedImage : undefined },
        customer,
        savedAt: new Date().toISOString(),
      }),
      "EX",
      ONE_YEAR_SECONDS
    );
    return true;
  } catch (err) {
    console.error("[paidBackup] No se pudo guardar el respaldo del pedido pagado:", err);
    return false;
  }
}
