import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductsByCategory } from "../../lib/catalog";
import { ESTUDIO_CATEGORIES } from "../../lib/estudioCategories";
import ProductGrid from "../../components/ProductGrid";

// Esta página lee el catálogo real (Redis) en cada visita — nunca debe
// quedar cacheada mostrando productos viejos/borrados (mismo motivo que
// app/page.js).
export const dynamic = "force-dynamic";

export default async function CategoriaPage({ params }) {
  const { slug } = await params;
  const category = ESTUDIO_CATEGORIES.find((c) => c.id === slug);

  if (!category) {
    notFound();
  }

  const products = await getProductsByCategory(slug);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6 sm:py-16">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-accent hover:text-white"
      >
        ← Volver al catálogo
      </Link>

      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{category.label}</h1>

      <p className="text-sm text-zinc-400 sm:text-base">
        Cuadros decorativos de excelente calidad. Recibe de 3 a 5 días hábiles. Envíos a toda
        Colombia completamente gratis.
      </p>

      <ProductGrid
        items={products}
        emptyMessage={`Todavía no hay diseños en ${category.label}. Vuelve pronto.`}
      />

      {/* CTA de personalización — mismo estilo destacado (glow morado)
          que la sección "Cuadros personalizados" del Home. */}
      <div
        className="relative mt-6 flex flex-col items-center gap-5 overflow-hidden rounded-3xl border border-white/10 px-6 py-12 text-center sm:gap-6 sm:px-12 sm:py-16"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(168,85,247,0.35), transparent 60%), radial-gradient(circle at 80% 80%, rgba(192,132,252,0.25), transparent 55%), #131018",
        }}
      >
        <h2 className="max-w-xl text-2xl font-extrabold tracking-tight sm:text-3xl">
          ¿Quieres un cuadro personalizado con tus imágenes?
        </h2>
        <Link
          href="/crear"
          className="w-full max-w-xs rounded-full bg-accent px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-accent/30 transition-colors hover:bg-accent-soft sm:w-auto"
        >
          Personalizar ahora
        </Link>
      </div>
    </div>
  );
}
