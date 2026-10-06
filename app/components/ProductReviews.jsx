// Reseñas aprobadas de ESTE producto en /producto/[id] (server component:
// HTML plano, 0 KB de JS). Si no hay ninguna, no se pinta nada — nada de
// "0 reseñas" ni estrellas vacías.
export default function ProductReviews({ reviews }) {
  if (!reviews || reviews.length === 0) return null;
  const average = Math.round((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length) * 10) / 10;

  return (
    <section aria-labelledby="resenas-producto" className="flex flex-col gap-3">
      <h2 id="resenas-producto" className="font-display text-lg font-bold tracking-tight">
        Reseñas de clientes{" "}
        <span className="font-sans text-sm font-medium text-[#5b6b8c]">
          · {average.toLocaleString("es-CO")} de 5 ({reviews.length})
        </span>
      </h2>
      <ul className="flex flex-col gap-3">
        {reviews.slice(0, 6).map((r) => (
          <li key={r.id} className="flex gap-3 rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
            {r.hasPhoto && (
              // eslint-disable-next-line @next/next/no-img-element -- foto servida por /api/review-photo, ya optimizada
              <img
                src={`/api/review-photo/${r.id}`}
                alt={`Cuadro de ${r.displayName} en su pared`}
                loading="lazy"
                decoding="async"
                className="h-24 w-24 shrink-0 rounded-xl object-cover"
              />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm text-accent" aria-label={`${r.rating} de 5 estrellas`}>
                {"★".repeat(r.rating)}
                <span className="text-zinc-300">{"★".repeat(5 - r.rating)}</span>
              </span>
              {r.comment && <p className="break-words text-sm text-[#1b2a4a]">{r.comment}</p>}
              <p className="text-xs font-medium text-[#5b6b8c]">
                {r.displayName}
                {r.sizeLabel ? ` · ${r.sizeLabel}` : ""} · compra verificada
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
