"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveOrder } from "../../lib/order";

// Reutiliza exactamente el mismo mecanismo que /crear (saveOrder +
// router.push a /checkout) — la diferencia es que acá el "readyOrder" se
// arma directo desde un producto del catálogo, sin pasar por el editor
// (subir/ajustar) porque el diseño ya viene listo. El tamaño ya no es
// fijo por producto: lo elige el comprador (ver ProductSizeSelector),
// así que sizeId/sizeLabel/priceCOP llegan como props en vez de leerse
// de product.size/product.priceCOP.
export default function ProductBuyButton({ product, sizeId, sizeLabel, frameType, priceCOP }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      await saveOrder({
        sizeId,
        sizeLabel,
        frameType,
        priceCOP,
        // El mockup público de Drive es lo único con URL accesible sin
        // autenticación desde el navegador — se usa para la vista del
        // cliente en /checkout y /checkout/confirmacion (croppedImage).
        // El archivo real de impresión (recorte + sangrado, para el
        // tamaño elegido) NO es público: se resuelve server-side en
        // /api/confirm-order (ver app/lib/catalogPurchase.js), que
        // vuelve a leer el producto real de Redis y descarga con OAuth2
        // el archivo de printFileIds correspondiente a order.sizeId —
        // nunca se confía en un fileId enviado desde el cliente.
        // printFileId acá es solo una referencia informativa (trazar a
        // qué archivo real corresponde este pedido), no se usa para
        // adjuntar nada directamente.
        croppedImage: product.thumbnailUrl,
        printFileId: product.printFileIds?.[sizeId] || null,
        needsAiUpscale: false,
        productId: product.id,
      });
      router.push("/checkout");
    } catch (err) {
      console.error("[producto] No se pudo guardar el pedido:", err);
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleContinue}
      disabled={isLoading}
      className="w-full rounded-full bg-accent px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
    >
      {isLoading ? "Cargando..." : "Continuar al pago"}
    </button>
  );
}
