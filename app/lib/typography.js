// Regla tipográfica de la tienda (oct 2026, aprobada por el dueño): la
// fuente display (RetroCool) se lee bien solo en títulos cortos. Para
// títulos que vienen de datos (landings, categorías, secciones) se decide
// por cantidad de palabras: ≤4 → .font-display; más largos → Geist (la
// fuente del contenedor .tienda) con text-balance para cortar bien las
// líneas. Ver .font-display / .tienda en app/globals.css.
export const DISPLAY_MAX_WORDS = 4;

export function isShortHeading(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length <= DISPLAY_MAX_WORDS;
}

export function headingFont(text) {
  return isShortHeading(text) ? "font-display" : "text-balance";
}
