// Mensaje de envío gratis con un toque de urgencia — reutilizado
// inline (dentro del flujo normal de la página, sin position fixed)
// en /crear, /producto/[id] y /checkout. El Home usa su propio badge
// a medida (mismo estilo que el badge ya existente del hero), así que
// no usa este componente.
export default function FreeShippingBanner() {
  return (
    <div className="flex min-h-9 w-full items-center justify-center rounded-xl border border-accent/30 bg-accent/15 px-3 py-1.5">
      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-medium leading-snug text-accent-soft sm:text-xs">
        <span aria-hidden="true" className="shrink-0">⏱️</span>
        <span>
          <span className="hidden sm:inline">Por tiempo limitado: </span>
          Envío gratis a todo el país
        </span>
      </p>
    </div>
  );
}
