"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

// Botón liviano: el visualizador (WallVisualizer.jsx) se descarga SOLO al
// tocarlo (o al pasar el mouse/dedo por encima, para que abra al instante)
// — no agrega nada al JS inicial de /crear, /ads ni /producto, y nunca
// hace peticiones de red propias (usa la imagen que la página ya tiene).
const loadVisualizer = () => import("./WallVisualizer");
const WallVisualizer = dynamic(loadVisualizer, { ssr: false });

export default function WallVisualizerButton({
  imageSrc,
  crop,
  imageRatio,
  sizes,
  initialSizeId,
  selectedSizeId,
  className = "",
  label = "🛋️ Así se ve en tu pared (tamaño real)",
}) {
  const [open, setOpen] = useState(false);
  const handleClose = useCallback(() => setOpen(false), []);
  if (!imageSrc || !sizes?.length) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onPointerEnter={loadVisualizer}
        onTouchStart={loadVisualizer}
        className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-accent/50 bg-white/70 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10 ${className}`}
      >
        {label}
      </button>
      {open && (
        <WallVisualizer
          imageSrc={imageSrc}
          crop={crop}
          imageRatio={imageRatio}
          sizes={sizes}
          initialSizeId={initialSizeId}
          selectedSizeId={selectedSizeId}
          onClose={handleClose}
        />
      )}
    </>
  );
}
