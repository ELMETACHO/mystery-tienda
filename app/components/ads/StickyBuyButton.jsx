"use client";

// Antes llevaba a /crear como página aparte; ahora el flujo vive embebido
// en esta misma página (ver app/ads/page.js), así que el botón hace scroll
// suave hasta esa sección en vez de navegar. position: fixed (no sticky)
// anclado a inset-x-0 bottom-0 — sticky en un contenedor con overflow puede
// "despegarse" en Safari durante el scroll, fixed se comporta igual en
// Safari iOS y Chrome Android.
export default function StickyBuyButton({ targetId }) {
  const handleClick = () => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-background/95 px-4 pt-3 backdrop-blur-md"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center justify-center rounded-full bg-accent px-6 py-4 text-base font-bold text-white shadow-lg shadow-accent/30 active:bg-accent-soft"
      >
        Comprar ahora
      </button>
    </div>
  );
}
