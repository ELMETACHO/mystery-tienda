import Redis from "ioredis";
import { randomUUID } from "crypto";

// Catálogo de productos generados desde /estudio: cada diseño subido a
// Drive queda registrado acá automáticamente, sin pasos extra para el
// diseñador. Mismo patrón de conexión que app/lib/loyalty.js (cliente
// ioredis propio, requiere REDIS_URL).

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.on("error", (err) => {
      console.error("[catalog] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

const CATALOG_KEY = "catalog:products";

// A diferencia de loyalty.js (que nunca lanza, para no bloquear un pago),
// acá SÍ se propaga el error: registrar el producto es el propósito
// completo de esta función — si falla, /estudio debe avisarle al
// diseñador en vez de fingir éxito silenciosamente.
//
// No se persiste priceCOP ni un tamaño fijo: el producto ahora vende los
// 3 tamaños de SIZES (app/lib/order.js), cada uno con su propio recorte
// horneado (printFileIds) — el precio y el tamaño los decide el
// comprador en /producto/[id], no el producto en sí.
export async function addCatalogProduct({
  categoryId,
  mockupFileId,
  originalRawFileId,
  originalRawContentHash,
  printFileIds,
  crop,
  zoom,
}) {
  const client = getRedisClient();
  if (!client) {
    throw new Error("REDIS_URL no está configurado; no se pudo registrar el producto.");
  }

  const product = {
    id: randomUUID(),
    category: categoryId,
    uploadedAt: new Date().toISOString(),
    mockupFileId,
    // originalRawFileId: la foto sin recortar que subió el diseñador.
    // originalRawContentHash: SHA-256 de esos mismos bytes crudos — se
    // usa para detectar en /estudio si el mismo diseño ya se subió antes
    // (en cualquier categoría), sin depender del nombre de archivo.
    // printFileIds: un archivo horneado (recorte + sangrado) por tamaño
    // de SIZES, ej. { "30x40": fileId, "40x50": fileId, "50x70": fileId }.
    // crop/zoom: parámetros de react-easy-crop en el momento de subir —
    // no se leen hoy en ningún flujo, se guardan solo para poder
    // regenerar printFiles en el futuro sin que el diseñador repita el
    // ajuste (ver EstudioApp.jsx).
    originalRawFileId,
    originalRawContentHash,
    printFileIds,
    crop,
    zoom,
    thumbnailUrl: `https://drive.google.com/thumbnail?id=${mockupFileId}&sz=w1000`,
    salesCount: 0,
  };

  await client.rpush(CATALOG_KEY, JSON.stringify(product));
  return product;
}

// Busca un producto existente con el MISMO hash de contenido del
// original crudo — usado por /api/estudio-check-duplicate para avisar
// (sin bloquear) si el diseñador ya subió este mismo diseño antes, en
// cualquier categoría. Nunca lanza, mismo principio que getCatalogProducts:
// si Redis no responde, simplemente no se detecta el duplicado esta vez,
// no debe impedir que el diseñador siga trabajando.
export async function findProductByContentHash(contentHash) {
  if (!contentHash) return null;
  const products = await getCatalogProducts();
  return products.find((p) => p.originalRawContentHash === contentHash) || null;
}

// Lee todo el catálogo. A diferencia de addCatalogProduct, esto NUNCA
// lanza — si Redis no está disponible, el Home debe poder renderizar
// igual (con un catálogo vacío) en vez de romper la página completa.
export async function getCatalogProducts() {
  const client = getRedisClient();
  if (!client) return [];

  try {
    const raw = await client.lrange(CATALOG_KEY, 0, -1);
    return raw
      .map((entry) => {
        try {
          return JSON.parse(entry);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (err) {
    console.error("[catalog] No se pudo leer el catálogo:", err);
    return [];
  }
}

export async function getCatalogProductById(id) {
  const products = await getCatalogProducts();
  return products.find((p) => p.id === id) || null;
}

// "Recientes": más nuevos primero.
export async function getRecentProducts(limit = 8) {
  const products = await getCatalogProducts();
  return [...products]
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    .slice(0, limit);
}

// "Más vendidos": por salesCount descendente. Como todavía no hay ventas
// reales, todos empatan en 0 — el desempate por fecha (más nuevo primero)
// hace que, mientras no haya ventas, el orden coincida exactamente con
// "Recientes" (comportamiento esperado, se explicó al pedir esta función).
export async function getBestSellingProducts(limit = 8) {
  const products = await getCatalogProducts();
  return [...products]
    .sort((a, b) => {
      if (b.salesCount !== a.salesCount) return b.salesCount - a.salesCount;
      return new Date(b.uploadedAt) - new Date(a.uploadedAt);
    })
    .slice(0, limit);
}

// Los productos viven como JSON planos dentro de una LIST de Redis (no un
// Hash por id), así que incrementar salesCount es un read-modify-write:
// se busca la entrada por id, se reescribe con LSET en su mismo índice.
// Nunca lanza — esto se llama al confirmar un pago (ver
// app/lib/catalogPurchase.js) y un fallo acá NUNCA debe impedir que el
// pedido se confirme ni que se envíen los correos; en el peor caso el
// contador simplemente no sube esta vez, se loguea para revisar a mano.
export async function incrementProductSalesCount(productId) {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const raw = await client.lrange(CATALOG_KEY, 0, -1);
    const index = raw.findIndex((entry) => {
      try {
        return JSON.parse(entry).id === productId;
      } catch {
        return false;
      }
    });

    if (index === -1) {
      console.error(`[catalog] incrementProductSalesCount: no existe el producto ${productId}`);
      return false;
    }

    const product = JSON.parse(raw[index]);
    product.salesCount = (product.salesCount || 0) + 1;
    await client.lset(CATALOG_KEY, index, JSON.stringify(product));
    return true;
  } catch (err) {
    console.error("[catalog] No se pudo incrementar salesCount:", err);
    return false;
  }
}
