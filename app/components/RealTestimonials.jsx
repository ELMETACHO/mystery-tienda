import { getHomeTestimonials } from "../lib/homeTestimonials";

// Reseñas REALES de clientes en /ads y /producto (oct 2026). Son las mismas
// que muestra el Home: las elige cada semana el cron
// select-home-testimonials a partir de reseñas verdaderas (/resena).
//
// - Nunca muestra ejemplos: si todavía no hay reseñas reales guardadas (o
//   Redis falla), no pinta nada. A diferencia del Home, acá no hay
//   fallback de ejemplo, porque en una landing de anuncios una cita
//   inventada sería publicidad engañosa (Ley 1480).
// - Sin promedio de estrellas: no hay una calificación promedio con fuente.
// - Componente de servidor: cero JS en el navegador. Las páginas lo envuelven
//   en <Suspense> para que nunca demore el primer pantallazo.
export default async function RealTestimonials({ max = 4, className = "" }) {
  const testimonios = (await getHomeTestimonials()).slice(0, max);
  if (testimonios.length === 0) return null;

  return (
    <section className={className}>
      <h2 className="mb-3 text-center text-sm font-semibold text-[#33456b]">
        Lo que dicen nuestros clientes
      </h2>
      <div className="mx-auto grid max-w-md grid-cols-1 gap-2.5">
        {testimonios.map((t, i) => (
          <figure
            key={`${t.nombre}-${i}`}
            className="rounded-2xl border border-black/5 bg-white/90 p-4 text-left shadow-sm"
          >
            <span className="text-sm text-accent" aria-label={`${t.rating || 5} de 5 estrellas`}>
              {"★".repeat(t.rating || 5)}
            </span>
            <blockquote className="mt-1.5 text-sm text-[#1b2a4a]">&ldquo;{t.texto}&rdquo;</blockquote>
            <figcaption className="mt-2 text-xs font-medium text-[#5b6b8c]">
              {t.nombre}
              {t.sizeLabel ? ` · cuadro ${t.sizeLabel}` : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
