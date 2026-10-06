import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalogProducts } from "../../lib/catalog";
import { ESTUDIO_CATEGORIES } from "../../lib/estudioCategories";
import { getCategorySeo } from "../../lib/categorySeo";
import { CHRISTMAS_DEADLINE, isChristmasDeadlineActive } from "../../lib/christmas";
import { LANDING_PAGES, getLandingPage, pickLandingProducts } from "../../lib/landingPages";
import { CATALOG_SIZES, SIZES, PRICES, formatCOP, getPriceCOP } from "../../lib/order";
import { SITE_URL } from "../../lib/siteUrl";
import { JsonLd, breadcrumbJsonLd, collectionPageJsonLd, faqPageJsonLd } from "../../lib/structuredData";
import Breadcrumbs from "../../components/Breadcrumbs";
import ProductScroller from "../../components/ProductScroller";
import { headingFont } from "../../lib/typography";

// Landings de intención de compra (contenido en app/lib/landingPages.js).
// A diferencia del Home/categorías (force-dynamic), acá alcanza con ISR
// cada hora: el texto es fijo, solo los ejemplos del catálogo y el aviso
// de Navidad (que se apaga solo por fecha) cambian — y una página
// estática carga más rápido en el celular.
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return LANDING_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = getLandingPage(slug);
  if (!page) return {};
  const url = `${SITE_URL}/cuadros/${page.slug}`;
  return {
    title: page.title,
    description: page.metaDescription,
    alternates: { canonical: url },
    openGraph: { title: page.title, description: page.metaDescription, url, type: "website", locale: "es_CO" },
  };
}

const CARD = "rounded-2xl border border-black/5 bg-[#fffaf0] p-5 shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)] sm:p-7";
const CTA =
  "inline-flex w-full max-w-xs items-center justify-center rounded-full bg-accent px-8 py-3.5 text-center text-base font-semibold text-white shadow-lg shadow-accent/30 transition-colors hover:bg-accent-soft sm:w-auto";

export default async function LandingPage({ params }) {
  const { slug } = await params;
  const page = getLandingPage(slug);
  if (!page) notFound();

  const path = `/cuadros/${page.slug}`;
  const products = pickLandingProducts(await getCatalogProducts(), page.productMatch);
  const showDeadline = page.christmas && isChristmasDeadlineActive();
  const faq = page.faq.map((item) =>
    item.christmasDeadline && showDeadline
      ? { ...item, respuesta: `${item.respuesta} ${CHRISTMAS_DEADLINE.message}.` }
      : item,
  );
  const breadcrumbs = [
    { name: "Inicio", path: "/" },
    { name: page.h1, path },
  ];
  const related = page.related.map(getLandingPage).filter(Boolean);
  const relatedCategories = page.relatedCategories
    .map((id) => ESTUDIO_CATEGORIES.find((c) => c.id === id))
    .filter(Boolean);
  const largeSizes = SIZES.filter((s) => !CATALOG_SIZES.includes(s));

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      <JsonLd data={faqPageJsonLd(faq)} />
      {products.length > 0 && (
        <JsonLd
          data={collectionPageJsonLd({ name: page.h1, description: page.metaDescription, path, products })}
        />
      )}
      <div className="tienda relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[#8fcaf0] text-[#1b2a4a]">
        <div
          aria-hidden="true"
          className="fixed inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/images/walls/fondo-cielo-2.webp)" }}
        />
        {/* Mobile-first: columna de max-w-3xl como siempre (celular y
            tablet). Desde lg se abre a max-w-6xl (mismo ancho que el Home):
            las secciones de texto y "precios | cómo se hace" van en 2
            columnas y los diseños del catálogo en grilla. Los wrappers usan
            flex-col gap-6, así que en celular nada cambia. */}
        <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-14 lg:max-w-6xl">
          <Breadcrumbs items={breadcrumbs} />

          {/* HERO: solo texto (sin imagen grande) para que el LCP en celular
              sea el propio h1. */}
          <section className={`${CARD} flex flex-col items-center gap-4 text-center`}>
            {showDeadline && (
              <p className="rounded-full bg-[#f3e8ff] px-4 py-1.5 text-xs font-semibold text-accent sm:text-sm">
                🎄 {CHRISTMAS_DEADLINE.message}
              </p>
            )}
            <h1 className={`${headingFont(page.h1)} text-2xl font-bold tracking-tight sm:text-4xl`}>{page.h1}</h1>
            <p className="max-w-xl text-sm text-[#33456b] sm:text-base">{page.lead}</p>
            <Link href="/crear" className={CTA}>
              Crear mi cuadro con mi foto
            </Link>
            <p className="text-xs text-[#5b6b8c]">
              Desde {formatCOP(getPriceCOP("30x40", "tradicional"))} · Envío gratis a toda Colombia · Hecho en 1-2 días · llega en máximo 5 días (sin domingos)
            </p>
          </section>

          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:[&>section:last-child:nth-child(odd)]:col-span-2">
          {page.sections.map((section) => (
            <section key={section.heading} className={CARD}>
              <h2 className={`${headingFont(section.heading)} mb-3 text-lg font-bold sm:text-xl`}>{section.heading}</h2>
              {section.paragraphs?.map((text) => (
                <p key={text.slice(0, 40)} className="mb-3 text-sm text-[#33456b] last:mb-0 sm:text-base">
                  {text}
                </p>
              ))}
              {section.bullets && (
                <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-[#33456b] sm:text-base">
                  {section.bullets.map((text) => (
                    <li key={text.slice(0, 40)}>{text}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          </div>

          {products.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className={`${headingFont(page.examplesHeading)} text-lg font-bold sm:text-xl`}>{page.examplesHeading}</h2>
              <ProductScroller items={products} light thumbWidth={480} desktopGrid={6} />
            </section>
          )}

          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2">
          {/* Precios reales desde app/lib/order.js (PRICES) — nunca
              escritos a mano en el contenido. */}
          <section className={CARD}>
            <h2 className="font-display mb-3 text-lg sm:text-xl">Tamaños y precios</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-[#5b6b8c]">
                    <th className="py-2 pr-3 font-medium">Tamaño</th>
                    <th className="py-2 pr-3 font-medium">Tradicional</th>
                    <th className="py-2 font-medium">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {SIZES.map((size) => (
                    <tr key={size.id} className="border-b border-black/5 last:border-0">
                      <td className="py-2 pr-3 font-medium">
                        {size.label}
                        {size.id === "40x50" && (
                          <span className="ml-1.5 whitespace-nowrap rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                            Más elegido
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {PRICES.tradicional[size.id] ? formatCOP(PRICES.tradicional[size.id]) : "—"}
                      </td>
                      <td className="py-2">{formatCOP(PRICES.premium[size.id])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-[#5b6b8c]">
              Envío gratis a toda Colombia incluido.
              {largeSizes.length > 0 &&
                ` ${largeSizes.map((s) => s.label).join(" y ")} solo en Premium, con tu propia foto.`}
            </p>
          </section>

          <section className={CARD}>
            <h2 className="font-display mb-3 text-lg sm:text-xl">Cómo se hace</h2>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-[#33456b] sm:text-base">
              <li>Sube tu foto en PNG, JPG, HEIC o PDF desde el celular o el computador.</li>
              <li>Ajústala dentro del marco (mueve y haz zoom) y elige el tamaño y el tipo de cuadro.</li>
              <li>Paga seguro con Wompi (tarjeta, PSE, Nequi o Daviplata) o contraentrega.</li>
              <li>Lo imprimimos en vinilo sobre madera en 1 a 2 días y te llega en máximo 5 días (sin domingos).</li>
            </ol>
          </section>
          </div>

          <section>
            <h2 className="font-display mb-3 text-lg sm:text-xl">Preguntas frecuentes</h2>
            <div className="flex flex-col divide-y divide-black/5 rounded-2xl border border-black/5 bg-[#fffaf0] shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)]">
              {faq.map((item) => (
                <details key={item.pregunta} className="group p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium sm:text-base">
                    {item.pregunta}
                    <span className="shrink-0 text-accent transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-[#33456b]">{item.respuesta}</p>
                </details>
              ))}
            </div>
          </section>

          <section
            className="flex flex-col items-center gap-4 rounded-[2rem] border border-black/5 px-6 py-10 text-center shadow-[0_16px_40px_-16px_rgba(30,20,60,0.25)]"
            style={{
              background:
                "radial-gradient(circle at 25% 15%, rgba(168,85,247,0.12), transparent 55%), radial-gradient(circle at 85% 85%, rgba(244,164,200,0.18), transparent 55%), #fffaf0",
            }}
          >
            <h2 className="text-balance text-xl font-bold tracking-tight sm:text-2xl">
              Crea tu cuadro en menos de 2 minutos
            </h2>
            <Link href="/crear" className={CTA}>
              Personalizar ahora
            </Link>
          </section>

          <nav aria-label="Más ideas" className={CARD}>
            <h2 className="font-display mb-3 text-base sm:text-lg">También te puede interesar</h2>
            <ul className="flex flex-wrap gap-2">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/cuadros/${item.slug}`}
                    className="inline-block rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-[#33456b] hover:border-accent hover:text-[#1b2a4a] sm:text-sm"
                  >
                    {item.navLabel}
                  </Link>
                </li>
              ))}
              {relatedCategories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/categoria/${category.id}`}
                    className="inline-block rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-[#33456b] hover:border-accent hover:text-[#1b2a4a] sm:text-sm"
                  >
                    {getCategorySeo(category).h1}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </main>
      </div>
    </>
  );
}
