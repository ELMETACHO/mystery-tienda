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

  // El tamaño ya no es fijo por producto (ver catalog.js) — cada producto
  // tiene un archivo horneado con sangrado POR TAMAÑO en printFileIds. Se
  // usa el que corresponde a order.sizeId (el tamaño que efectivamente
  // eligió y pagó el cliente en /producto/[id]), nunca uno fijo. El
  // printFileId se resuelve siempre server-side a partir del producto
  // real en Redis — nunca se confía en un fileId que venga directo del
  // pedido/cliente.
  const printFileId = product.printFileIds?.[order.sizeId];
  // DIAGNÓSTICO TEMPORAL — quitar una vez confirmada la causa del bug de
  // 30x40 (ver conversación).
  console.log("[catalogPurchase][diag]", {
    orderSizeId: order.sizeId,
    productId: product.id,
    printFileIds: product.printFileIds,
    resolvedPrintFileId: printFileId,
  });
  if (!printFileId) {
    console.error(
      `[catalogPurchase] El producto ${product.id} no tiene printFileIds para el tamaño "${order.sizeId}"`
    );
    return { printImageBase64: null };
  }

  let printImageBase64 = null;
  try {
    const buffer = await downloadFileBuffer(printFileId);
    printImageBase64 = buffer.toString("base64");
  } catch (err) {
    console.error(
      "[catalogPurchase] No se pudo descargar el archivo de impresión desde Drive:",
      err
    );
  }

  return { printImageBase64 };
}
