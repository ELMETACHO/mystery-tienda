import { getCatalogProductById, incrementProductSalesCount } from "./catalog";
import { downloadFileBuffer } from "./googleDrive";

// Se llama al confirmar el pago de un pedido que viene de /producto/[id]
// (catálogo) — identificado por order.productId, que ProductBuyButton.jsx
// guarda en el pedido antes de ir a /checkout. Pedidos normales de
// /crear no tienen productId, así que esto no hace nada para ellos.
//
// Nunca lanza: un fallo acá NUNCA debe impedir que el pedido se confirme
// ni que se envíen los correos (mismo principio que Skydropx/loyalty en
// los otros endpoints de confirmación). En el peor caso, el contador de
// ventas no sube esta vez y/o el correo del fabricante queda sin el
// adjunto de alta calidad — ambos casos quedan logueados para resolver a
// mano.
export async function processCatalogProductPurchase(order) {
  if (!order?.productId) {
    return { printImageBase64: null };
  }

  let product;
  try {
    product = await getCatalogProductById(order.productId);
  } catch (err) {
    console.error("[catalogPurchase] No se pudo leer el producto del catálogo:", err);
    return { printImageBase64: null };
  }

  if (!product) {
    console.error(
      "[catalogPurchase] order.productId no coincide con ningún producto del catálogo:",
      order.productId
    );
    return { printImageBase64: null };
  }

  const incremented = await incrementProductSalesCount(product.id);
  if (!incremented) {
    console.error("[catalogPurchase] No se pudo incrementar salesCount de", product.id);
  }

  let printImageBase64 = null;
  try {
    const buffer = await downloadFileBuffer(product.originalFileId);
    printImageBase64 = buffer.toString("base64");
  } catch (err) {
    console.error(
      "[catalogPurchase] No se pudo descargar el archivo de portafolio desde Drive:",
      err
    );
  }

  return { printImageBase64 };
}
