// Mensaje de envío gratis con un toque de urgencia — reutilizado
// inline (dentro del flujo normal de la página, sin position fixed)
// en /crear, /producto/[id] y /checkout. El Home usa su propio badge
// a medida (mismo estilo que el badge ya existente del hero), así que
// no usa este componente.
export default function FreeShippingBanner() {
  return (
    <div className="flex h-9 items-center justify-center rounded-full border border-accent/30 bg-accent/15">
      <p className="flex items-center justify-center gap-1.5 whitespace-nowrap px-4 text-center text-[11px] font-medium text-accent-soft sm:text-xs">
        <span aria-hidden="true">⏱️</span>
        <span>
          <span className="hidden sm:inline">Por tiempo limitado: </span>
          Envío gratis a todo el país
        </span>
      </p>
    </div>
  );
}
