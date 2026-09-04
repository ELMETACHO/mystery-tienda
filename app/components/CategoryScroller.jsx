'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

// Fila de categorías con scroll horizontal + snap. Las flechas de
// desktop solo controlan el scroll nativo del contenedor (scrollBy),
// no reimplementan el carrusel — así el swipe táctil en móvil y el
// clic en desktop comparten el mismo estado de scroll.
export default function CategoryScroller({ categorias, light = false }) {
  const trackRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    const updateArrows = () => {
      const maxScrollLeft = track.scrollWidth - track.clientWidth;
      setCanScrollLeft(track.scrollLeft > 1);
      setCanScrollRight(track.scrollLeft < maxScrollLeft - 1);
    };

    updateArrows();
    track.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);

    return () => {
      track.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, []);

  const scrollByCard = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector('[data-category-card]');
    const cardWidth = card?.getBoundingClientRect().width ?? track.clientWidth * 0.4;
    track.scrollBy({ left: direction * (cardWidth + 12), behavior: 'smooth' });
  };

  return (
    <div className="relative">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          aria-label="Ver categorías anteriores"
          className="absolute left-0 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 p-2 text-white shadow-lg backdrop-blur transition hover:bg-black/90 sm:flex"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 sm:gap-4"
      >
        {categorias.map((cat) => (
          <Link
            key={cat.nombre}
            href={`/categoria/${cat.id}`}
            data-category-card
            className={`group relative aspect-[3/4] w-36 shrink-0 snap-start overflow-hidden rounded-2xl border sm:w-44 ${
              light ? "border-black/10 shadow-md" : "border-white/10"
            }`}
          >
            <Image
              src={cat.src}
              alt={cat.nombre}
              fill
              sizes="(min-width: 640px) 20vw, 40vw"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-3 text-base font-semibold text-white sm:text-lg">
              {cat.nombre}
            </span>
          </Link>
        ))}
      </div>

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          aria-label="Ver más categorías"
          className="absolute right-0 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 p-2 text-white shadow-lg backdrop-blur transition hover:bg-black/90 sm:flex"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
