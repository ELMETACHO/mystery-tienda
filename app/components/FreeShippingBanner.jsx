// Mensaje de envío gratis — reutilizado
// inline (dentro del flujo normal de la página, sin position fixed)
// en /crear, /producto/[id] y /checkout. El Home usa su propio badge
// a medida (mismo estilo que el badge ya existente del hero), así que
// no usa este componente.
export default function FreeShippingBanner() {
  return (
    <div className="flex min-h-9 w-full items-center justify-center rounded-xl border border-accent/30 bg-accent/15 px-3 py-1.5">
      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-medium leading-snug text-accent sm:text-xs">
        {/* Sin "por tiempo limitado": el envío gratis es permanente y
            decirlo sería urgencia falsa (Ley 1480, ver ADS.md). */}
        <span aria-hidden="true" className="shrink-0">🚚</span>
        <span>Envío gratis a todo el país</span>
      </p>
    </div>
  );
}
