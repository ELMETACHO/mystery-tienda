import Image from "next/image";
import Link from "next/link";
import { categoryLabel } from "../components/ProductGrid";
import { SIZES, getPriceCOP, formatCOP } from "../lib/order";

// Mismo precio de referencia que ProductCard (el tamaño+tipo más barato).
const DESDE_COP = getPriceCOP(SIZES[0].id, "tradicional");

// Fila de diseños del catálogo SOLO para /ads. Reemplaza al
// ProductScroller del Home en esta página por peso: ProductCard usa las
// miniaturas originales de /api/catalog-thumbnail con `unoptimized` (PNG
// de ~3 MB cada una — Lighthouse midió 11 de ellas = 34 MB en una sola
// carga de /ads, oct 2026), para no gastar la cuota del optimizador de
// imágenes de Vercel en los ~200 productos del Home.
//
// Acá se muestran pocos productos (los más recientes) y SÍ pasan por el
// optimizador con `sizes` fijo de 160px: como máximo 2 variantes por
// imagen (pantallas 2x y 3x) × ADS_CATALOG_LIMIT productos — un consumo
// mínimo y acotado de la cuota, a cambio de bajar cada miniatura de ~3 MB
// a ~20-40 KB. Se cargan en diferido (lazy, comportamiento por defecto de
// next/image), solo cuando el cliente baja hasta acá.
export const ADS_CATALOG_LIMIT = 12;

export default function AdsCatalogStrip({ items }) {
  if (!items?.length) return null;

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
      {items.map((item) => {
        const name = item.name ? `Cuadro ${item.name}` : `Cuadro ${categoryLabel(item.category)}`;
        return (
          <Link
            key={item.id}
            href={`/producto/${item.id}`}
            className="flex w-40 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-black/5 bg-[#fffaf0] shadow-[0_10px_25px_-12px_rgba(30,20,60,0.3)]"
          >
            <span className="relative block aspect-square overflow-hidden bg-black/5">
              <Image
                src={`/api/catalog-thumbnail/${item.mockupFileId}`}
                alt={`${name}, en vinilo sobre madera`}
                fill
                sizes="160px"
                className="object-cover"
              />
            </span>
            <span className="flex flex-1 flex-col gap-1 p-3">
              <span className="line-clamp-2 min-h-[2.5em] text-sm font-medium text-[#1b2a4a]">
                {name}
              </span>
              <span className="text-sm font-semibold text-accent">Desde {formatCOP(DESDE_COP)}</span>
              <span className="mt-auto rounded-full bg-accent px-4 py-2 text-center text-xs font-medium text-white">
                Ver diseño
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
