import Image from "next/image";
import Link from "next/link";
import { SIZES, getPriceCOP, formatCOP } from "../lib/order";
import { ESTUDIO_CATEGORIES } from "../lib/estudioCategories";

// Precio de referencia para las tarjetas: el tamaño+tipo más barato (hoy
// 30x40 Tradicional) — cada producto ya no vende un tamaño ni un precio
// fijo, el comprador elige el tamaño y el tipo de cuadro en /producto/[id].
const CHEAPEST_SIZE_PRICE_COP = getPriceCOP(SIZES[0].id, "tradicional");

export function categoryLabel(categoryId) {
  return ESTUDIO_CATEGORIES.find((c) => c.id === categoryId)?.label || "Diseño";
}

// Tarjeta de producto reusada en Home ("Recientes"/"Más vendidos", grid y
// ProductScroller) y en /categoria/[slug] — datos reales del catálogo
// (Redis, vía /estudio). La imagen es el link de miniatura pública de
// Drive, y "Comprar ahora" lleva a la página de detalle/checkout de ESE
// producto puntual (/producto/[id]), no al editor genérico.
export function ProductCard({ item, className = "", ...rest }) {
  return (
    <div
      {...rest}
      className={`group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 ${className}`}
    >
      <Link
        href={`/producto/${item.id}`}
        className="relative block aspect-square overflow-hidden"
      >
        <Image
          src={item.thumbnailUrl}
          alt={categoryLabel(item.category)}
          fill
          sizes="(min-width: 640px) 25vw, 50vw"
          className="object-cover transition-transform duration-300 ease-out group-hover:scale-110"
        />
      </Link>
      {/* min-h reserva la altura de 2 líneas de categoryLabel (con
          line-clamp-2 por si el nombre es largo) y mt-auto ancla
          "Comprar ahora" siempre al fondo de la tarjeta — así todas
          quedan alineadas entre sí sin importar cuánto texto haya
          arriba. */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 min-h-[2.5em] text-sm font-medium text-zinc-200">
          Cuadro {categoryLabel(item.category)}
        </h3>
        <p className="text-sm font-semibold text-accent-soft">
          Desde {formatCOP(CHEAPEST_SIZE_PRICE_COP)}
        </p>
        <Link
          href={`/producto/${item.id}`}
          className="mt-auto w-full rounded-full bg-accent px-4 py-2 text-center text-xs font-medium text-white opacity-100 transition-all duration-200 hover:bg-accent-soft sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100"
        >
          Comprar ahora
        </Link>
      </div>
    </div>
  );
}

export default function ProductGrid({ items, emptyMessage = "Todavía no hay productos en el catálogo. Vuelve pronto." }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-zinc-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {items.map((item) => (
        <ProductCard key={item.id} item={item} />
      ))}
    </div>
  );
}
