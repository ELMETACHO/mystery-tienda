'use client';

import { useEffect, useRef, useState } from 'react';
import { ProductCard } from './ProductGrid';

// Fila de productos con scroll horizontal + snap para "Recientes"/"Más
// vendidos" — mismo patrón que CategoryScroller.jsx: scroll NATIVO
// (overflow-x-auto), sin animación ni JS moviendo posición, sin
// duplicar items ni bucle. Las flechas de desktop solo llaman scrollBy
// sobre el contenedor, igual que CategoryScroller, así el swipe táctil
// en móvil y el clic en desktop comparten el mismo estado de scroll
// nativo.
export default function ProductScroller({ items, emptyMessage = 'Todavía no hay productos en el catálogo. Vuelve pronto.', light = false }) {
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
  }, [items.length]);

  const scrollByCard = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector('[data-product-card]');
    const cardWidth = card?.getBoundingClientRect().width ?? track.clientWidth * 0.4;
    track.scrollBy({ left: direction * (cardWidth + 12), behavior: 'smooth' });
  };

  if (items.length === 0) {
    return (
      <p
        className={`rounded-xl border px-4 py-6 text-center text-sm ${
          light
            ? "border-black/10 bg-white/60 text-[#33456b]"
            : "border-white/10 bg-white/5 text-zinc-500"
        }`}
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="relative">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          aria-label="Ver productos anteriores"
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
        {items.map((item) => (
          <ProductCard
            key={item.id}
            item={item}
            light={light}
            data-product-card
            className="w-40 shrink-0 snap-start sm:w-56"
          />
        ))}
      </div>

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          aria-label="Ver más productos"
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
