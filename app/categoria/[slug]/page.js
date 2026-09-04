import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductsByCategory } from "../../lib/catalog";
import { ESTUDIO_CATEGORIES } from "../../lib/estudioCategories";
import ProductScroller from "../../components/ProductScroller";

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
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[#8fcaf0] text-[#1b2a4a]">
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/walls/fondo-cielo-2.webp)" }}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-black/10 bg-[#fffaf0] px-4 py-2 text-sm font-medium text-[#33456b] shadow-sm transition-colors hover:border-accent hover:text-[#1b2a4a]"
        >
          ← Volver al catálogo
        </Link>

        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{category.label}</h1>

        <p className="text-sm text-[#33456b] sm:text-base">
          Cuadros decorativos de excelente calidad. Recibe de 3 a 5 días hábiles. Envíos a toda
          Colombia completamente gratis.
        </p>

        <ProductScroller
          items={products}
          emptyMessage={`Todavía no hay diseños en ${category.label}. Vuelve pronto.`}
          light
        />

        {/* CTA de personalización — mismo tratamiento que "Cuadros
            personalizados" del Home: tarjeta crema con acentos suaves de
            morado/rosa en vez del degradado morado oscuro anterior. */}
        <div
          className="relative mt-6 flex flex-col items-center gap-5 overflow-hidden rounded-[2.5rem] border border-black/5 px-6 py-12 text-center shadow-[0_16px_40px_-16px_rgba(30,20,60,0.25)] sm:gap-6 sm:px-12 sm:py-16"
          style={{
            background:
              "radial-gradient(circle at 25% 15%, rgba(168,85,247,0.12), transparent 55%), radial-gradient(circle at 85% 85%, rgba(244,164,200,0.18), transparent 55%), #fffaf0",
          }}
        >
          <h2 className="font-heading max-w-xl text-2xl font-extrabold tracking-tight text-[#1b2a4a] sm:text-3xl">
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
    </div>
  );
}
