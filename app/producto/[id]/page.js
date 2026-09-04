import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalogProductById } from "../../lib/catalog";
import { ESTUDIO_CATEGORIES } from "../../lib/estudioCategories";
import ProductSizeSelector from "./ProductSizeSelector";

function categoryLabel(categoryId) {
  return ESTUDIO_CATEGORIES.find((c) => c.id === categoryId)?.label || "Diseño";
}

export default async function ProductPage({ params }) {
  const { id } = await params;
  const product = await getCatalogProductById(id);

  if (!product) {
    notFound();
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[#8fcaf0] text-[#1b2a4a]">
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/walls/fondo-cielo-2.webp)" }}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-black/10 bg-[#fffaf0] px-4 py-2 text-sm font-medium text-[#33456b] shadow-sm transition-colors hover:border-accent hover:text-[#1b2a4a]"
        >
          ← Volver al catálogo
        </Link>

        <div
          className="relative w-full overflow-hidden rounded-2xl border border-black/10 shadow-[0_20px_50px_-16px_rgba(30,20,60,0.35)]"
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
          <span className="w-fit rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
            {categoryLabel(product.category)}
          </span>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Cuadro personalizado</h1>
        </div>

        <ProductSizeSelector product={product} />

        <p className="text-center text-base font-semibold text-accent">
          Recibe de 3 a 5 días hábiles
        </p>
      </div>
    </div>
  );
}
