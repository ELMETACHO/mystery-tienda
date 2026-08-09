"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveOrder } from "../../lib/order";

// Reutiliza exactamente el mismo mecanismo que /crear (saveOrder +
// router.push a /checkout) — la diferencia es que acá el "readyOrder" se
// arma directo desde un producto del catálogo, sin pasar por el editor
// (subir/ajustar) porque el diseño ya viene listo.
export default function ProductBuyButton({ product, sizeLabel }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      await saveOrder({
        sizeId: product.size,
        sizeLabel,
        priceCOP: product.priceCOP,
        // El mockup público de Drive es lo único con URL accesible sin
        // autenticación — se usa tanto para la vista del cliente
        // (croppedImage) como para el adjunto del fabricante (printImage).
        // PENDIENTE: el archivo real de "Original (Portafolio)" (mayor
        // calidad, con sangrado) no es público — para usarlo en el correo
        // del fabricante hace falta traerlo server-side con las
        // credenciales OAuth2 en /api/confirm-order, no solo linkearlo.
        croppedImage: product.thumbnailUrl,
        printImage: product.thumbnailUrl,
        isLowResolution: false,
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
