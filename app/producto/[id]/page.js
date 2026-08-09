import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalogProductById } from "../../lib/catalog";
import { SIZES, formatCOP } from "../../lib/order";
import { ESTUDIO_CATEGORIES } from "../../lib/estudioCategories";
import ProductBuyButton from "./ProductBuyButton";

function categoryLabel(categoryId) {
  return ESTUDIO_CATEGORIES.find((c) => c.id === categoryId)?.label || "Diseño";
}

export default async function ProductPage({ params }) {
  const { id } = await params;
  const product = await getCatalogProductById(id);

  if (!product) {
    notFound();
  }

  // Los productos de /estudio siempre son 40x50 (ver EstudioApp.jsx) —
  // se toma el label/ratio reales de SIZES en vez de hardcodearlos, para
  // no desincronizarse si esos valores cambian.
  const size = SIZES.find((s) => s.id === product.size) || SIZES.find((s) => s.id === "40x50");

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10 sm:px-6 sm:py-16">
      <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Volver al catálogo
      </Link>

      <div
        className="relative w-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        style={{ aspectRatio: 1080 / 1350 }}
      >
        <Image
          src={product.thumbnailUrl}
          alt={`Cuadro ${categoryLabel(product.category)}`}
          fill
          sizes="(min-width: 640px) 448px, 100vw"
          className="object-cover"
          priority
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="w-fit rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent-soft">
          {categoryLabel(product.category)}
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Cuadro personalizado</h1>
        <p className="text-sm text-zinc-400">Tamaño {size.label}</p>
        <p className="mt-2 text-3xl font-bold text-accent-soft">{formatCOP(product.priceCOP)}</p>
      </div>

      <ProductBuyButton product={product} sizeLabel={size.label} />

      <p className="text-center text-xs text-zinc-500">
        Diseño listo — sin necesidad de subir ni ajustar imagen. Solo falta decirnos dónde
        enviarlo.
      </p>
    </div>
  );
}
