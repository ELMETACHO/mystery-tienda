"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { GALLERY_KINDS } from "../../lib/productGallery";

// Galería con miniaturas (oct 2026). Solo se descarga la foto que se está
// viendo: la principal (priority, es el LCP) y las demás recién cuando el
// usuario toca su miniatura o desliza. Las miniaturas genéricas pesan ~2KB
// y la del diseño reutiliza la foto principal ya cargada.
// Mismo marco 1080×1350 (4:5) que antes → sin saltos de layout.
export default function ProductGallery({ images, sizes }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef(null);
  const current = images[index] || images[0];
  const many = images.length > 1;

  const go = (next) => setIndex((next + images.length) % images.length);

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-black/10 bg-[#fffaf0] shadow-[0_20px_50px_-16px_rgba(30,20,60,0.35)]"
        style={{ aspectRatio: 1080 / 1350 }}
        onTouchStart={many ? (e) => (touchX.current = e.touches[0].clientX) : undefined}
        onTouchEnd={
          many
            ? (e) => {
                if (touchX.current == null) return;
                const dx = e.changedTouches[0].clientX - touchX.current;
                touchX.current = null;
                if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
              }
            : undefined
        }
      >
        <Image
          key={current.src}
          src={current.src}
          alt={current.alt}
          fill
          unoptimized
          sizes={sizes}
          className="object-cover"
          priority={index === 0}
        />
        {current.caption && (
          <p className="absolute inset-x-3 bottom-3 rounded-full bg-black/55 px-3 py-1.5 text-center text-[11px] font-medium text-white backdrop-blur-sm">
            {current.caption}
          </p>
        )}
        {many && (
          <span className="absolute right-3 top-3 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white">
            {index + 1}/{images.length}
          </span>
        )}
      </div>

      {many && (
        <div className="flex gap-2" role="tablist" aria-label="Fotos del cuadro">
          {images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Ver foto ${i + 1}: ${GALLERY_KINDS[img.kind] || "foto"}`}
              onClick={() => setIndex(i)}
              className={`relative h-[70px] w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-[#fffaf0] transition ${
                i === index ? "border-accent" : "border-transparent opacity-75 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura fija de ~2KB, next/image no aporta */}
              <img src={img.thumb} alt="" width={56} height={70} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </button>
          ))}
          <p className="ml-1 self-center text-[11px] leading-tight text-[#5b6b8c]">
            {GALLERY_KINDS[current.kind] || ""}
          </p>
        </div>
      )}
    </div>
  );
}
