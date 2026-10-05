import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductsByCategory } from "../../lib/catalog";
import { ESTUDIO_CATEGORIES } from "../../lib/estudioCategories";
import { SITE_URL } from "../../lib/siteUrl";
import { getCategorySeo } from "../../lib/categorySeo";
import ProductScroller from "../../components/ProductScroller";
import Breadcrumbs from "../../components/Breadcrumbs";
import RelatedLinks from "../../components/RelatedLinks";
import { getLandingPage } from "../../lib/landingPages";
import { JsonLd, breadcrumbJsonLd, collectionPageJsonLd } from "../../lib/structuredData";

// Esta página lee el catálogo real (Redis) en cada visita — nunca debe
// quedar cacheada mostrando productos viejos/borrados (mismo motivo que
// app/page.js).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const category = ESTUDIO_CATEGORIES.find((c) => c.id === slug);
  if (!category) return {};

  const { title, metaDescription } = getCategorySeo(category);
  return {
    title,
    description: metaDescription,
    alternates: { canonical: `${SITE_URL}/categoria/${category.id}` },
    openGraph: { title, description: metaDescription, url: `${SITE_URL}/categoria/${category.id}` },
  };
}

export default async function CategoriaPage({ params }) {
  const { slug } = await params;
  const category = ESTUDIO_CATEGORIES.find((c) => c.id === slug);

  if (!category) {
    notFound();
  }

  const products = await getProductsByCategory(slug);
  const seo = getCategorySeo(category);
  const path = `/categoria/${category.id}`;
  const relatedLinks = [
    ...seo.relatedCategories
      .map((id) => ESTUDIO_CATEGORIES.find((c) => c.id === id))
      .filter(Boolean)
      .map((c) => ({ href: `/categoria/${c.id}`, label: getCategorySeo(c).h1 })),
    ...seo.relatedLandings
      .map(getLandingPage)
      .filter(Boolean)
      .map((l) => ({ href: `/cuadros/${l.slug}`, label: l.navLabel })),
  ];
  const breadcrumbs = [
    { name: "Inicio", path: "/" },
    { name: seo.h1, path },
  ];

  return (
    <>
    <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
    <JsonLd
      data={collectionPageJsonLd({
        name: seo.h1,
        description: seo.metaDescription,
        path,
        products,
      })}
    />
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

        <Breadcrumbs items={breadcrumbs} />

        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{seo.h1}</h1>

        <p className="text-sm text-[#33456b] sm:text-base">{seo.intro || category.description}</p>

        <p className="text-sm text-[#33456b] sm:text-base">
          Cuadros decorativos de excelente calidad. Hecho en 1-2 días · llega en máximo 5 días (sin domingos). Envíos a toda
          Colombia completamente gratis.
        </p>

        <ProductScroller
          items={products}
          emptyMessage={`Todavía no hay diseños en ${category.label}. Vuelve pronto.`}
          light
          thumbWidth={480}
          eagerCount={2}
        />

        {seo.body.length > 0 && (
          <section className="rounded-2xl border border-black/5 bg-[#fffaf0] p-5 shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)] sm:p-7">
            <h2 className="font-heading mb-3 text-lg font-bold sm:text-xl">Sobre estos cuadros</h2>
            {seo.body.map((text) => (
              <p key={text.slice(0, 40)} className="mb-3 text-sm text-[#33456b] last:mb-0 sm:text-base">
                {text}
              </p>
            ))}
            <p className="mt-3 text-sm text-[#33456b] sm:text-base">
              Todos se imprimen en vinilo sobre madera, en 30x40, 40x50 o 50x70 cm, en versión
              Premium (con marco trasero de 3 cm) o Tradicional (más delgado, con soporte para
              colgar).
            </p>
          </section>
        )}

        <RelatedLinks title="También te puede interesar" links={relatedLinks} />

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
            No encuentras lo que buscas? créalo tú mismo
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
    </>
  );
}
