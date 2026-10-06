"use client";

import { useEffect, useRef, useState } from "react";
import { headingFont } from "../lib/typography";

// "Fotos de clientes": reseñas REALES aprobadas en /admin/resenas (con
// autorización del cliente). Cero costo en la carga inicial: no hace
// ningún request hasta que la sección está a ~400 px de entrar en
// pantalla, y si no hay reseñas aprobadas no pinta nada (ni título, ni
// estrellas, ni promedio inventado).
// Una sola petición por URL aunque el componente se vuelva a montar (p. ej.
// cuando /ads re-renderiza secciones al avanzar el flujo de compra).
const requests = new Map();
function loadReviews(url) {
  if (!requests.has(url)) {
    requests.set(
      url,
      fetch(url)
        .then((res) => (res.ok ? res.json() : { reviews: [] }))
        .then((data) => (Array.isArray(data.reviews) ? data.reviews : []))
        .catch(() => [])
    );
  }
  return requests.get(url);
}

export default function CustomerReviews({
  title = "Fotos de nuestros clientes",
  onlyPhotos = false,
  limit = 6,
  className = "",
}) {
  const ref = useRef(null);
  const [reviews, setReviews] = useState(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        loadReviews(`/api/reviews/approved?limit=${limit}${onlyPhotos ? "&photos=1" : ""}`).then((list) => {
          if (!cancelled) setReviews(list);
        });
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [limit, onlyPhotos]);

  if (!reviews || reviews.length === 0) {
    // Marcador invisible de 1 px para el IntersectionObserver (no mueve el
    // layout: no hay salto de contenido si nunca hay reseñas).
    return <div ref={ref} aria-hidden="true" className="h-px w-full" />;
  }

  return (
    <div ref={ref} className={className}>
      <h2 className={`${headingFont(title)} mb-3 text-center text-lg font-bold tracking-tight sm:text-xl`}>{title}</h2>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-3">
        {reviews.map((r) => (
          <figure
            key={r.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white text-left shadow-sm"
          >
            {r.hasPhoto && (
              // eslint-disable-next-line @next/next/no-img-element -- foto servida por /api/review-photo, ya optimizada (≤1200 px JPEG)
              <img
                src={`/api/review-photo/${r.id}`}
                alt={`Cuadro de ${r.displayName} en su pared`}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover"
              />
            )}
            <figcaption className="flex flex-col gap-1 p-3">
              <span className="text-sm text-accent" aria-label={`${r.rating} de 5 estrellas`}>
                {"★".repeat(r.rating)}
                <span className="text-zinc-300">{"★".repeat(5 - r.rating)}</span>
              </span>
              {r.comment && <p className="line-clamp-4 text-sm text-[#1b2a4a]">&ldquo;{r.comment}&rdquo;</p>}
              <p className="text-xs font-medium text-[#5b6b8c]">
                {r.displayName}
                {r.sizeLabel ? ` · ${r.sizeLabel}` : ""} · compra verificada
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
