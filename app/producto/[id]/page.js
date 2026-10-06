import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalogProductById, getProductsByCategory } from "../../lib/catalog";
import { ESTUDIO_CATEGORIES } from "../../lib/estudioCategories";
import { SIZES, CATALOG_SIZES, FRAME_TYPES, getPriceCOP, formatCOP } from "../../lib/order";
import { SITE_URL } from "../../lib/siteUrl";
import ProductSizeSelector from "./ProductSizeSelector";
import Breadcrumbs from "../../components/Breadcrumbs";
import { getCategorySeo } from "../../lib/categorySeo";
import { JsonLd, breadcrumbJsonLd } from "../../lib/structuredData";
import { getLandingPage } from "../../lib/landingPages";
import { FEED_DEFAULT_PRICE_COP } from "../../lib/googleFeed";
import ProductScroller from "../../components/ProductScroller";
import RelatedLinks from "../../components/RelatedLinks";
import DeliveryEstimate from "../../components/DeliveryEstimate";
import { headingFont } from "../../lib/typography";
import ProductReviews from "../../components/ProductReviews";
import { getApprovedReviews } from "../../lib/reviews";
import { buildProductReviewJsonLd } from "../../lib/reviewModeration";
import WallVisualizerButton from "../../components/WallVisualizerButton";
import ProductGallery from "./ProductGallery";
import ProductStickyBar from "./ProductStickyBar";
import { getProductGalleryImages } from "../../lib/productGallery";

function categoryLabel(categoryId) {
  return ESTUDIO_CATEGORIES.find((c) => c.id === categoryId)?.label || "Diseño";
}

// product.name/product.description los genera la IA a partir del mockup
// al subir en /estudio (ver app/lib/aiProductText.js) — productos subidos
// antes de que existiera esa generación, o donde falló, no los tienen y
// caen de vuelta al texto genérico por categoría de siempre.
function productDisplayTitle(product, label) {
  return product.name ? `Cuadro ${product.name}` : `Cuadro Personalizado ${label}`;
}

function productDisplayDescription(product, label) {
  return (
    product.description ||
    `Cuadro personalizado de ${label} en vinilo sobre madera, disponible en 30x40, 40x50 y 50x70 cm.`
  );
}

const CHEAPEST_PRICE_COP = getPriceCOP(SIZES[0].id, "tradicional");

// Dónde está el diseño dentro del mockup 1080x1350 que genera /estudio:
// centrado, 58% del ancho, proporción 4:5 → 626x783 px desde (227, 284).
const MOCKUP_DESIGN_CROP = { left: 0.21, top: 0.21, width: 0.58, height: 0.58 };

export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await getCatalogProductById(id);
  if (!product) return {};

  const label = categoryLabel(product.category);
  // Nombre del diseño primero (es lo que se busca, ej. "death note
  // cuadro"), precio "desde" como gancho de CTR y marca al final — si
  // Google trunca, se pierde la marca, no el nombre.
  const title = `${productDisplayTitle(product, label)} | Desde ${formatCOP(CHEAPEST_PRICE_COP)} · Mystery Cuadros`;
  const description = `${productDisplayDescription(product, label)} Vinilo sobre madera en 30x40, 40x50 o 50x70 cm, desde ${formatCOP(CHEAPEST_PRICE_COP)}. Envío gratis a toda Colombia.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/producto/${product.id}` },
    openGraph: {
      title,
      description,
      // JPEG de 1200px: WhatsApp/Facebook no muestran vistas previas de
      // imágenes muy pesadas (el PNG original pesa ~3 MB).
      images: [{ url: `${SITE_URL}/api/catalog-thumbnail/${product.mockupFileId}?w=1200&f=jpg` }],
    },
  };
}

export default async function ProductPage({ params }) {
  const { id } = await params;
  const product = await getCatalogProductById(id);

  if (!product) {
    notFound();
  }

  const label = categoryLabel(product.category);
  // Otros diseños de la misma categoría (enlaces internos producto →
  // producto) — más nuevos primero, sin el actual.
  // Reseñas aprobadas en paralelo con la categoría (sin sumar latencia:
  // getApprovedReviews tiene caché en memoria de 5 min y nunca lanza).
  const [categoryProducts, approvedReviews] = await Promise.all([
    getProductsByCategory(product.category),
    getApprovedReviews(),
  ]);
  const sameCategory = categoryProducts.filter((p) => p.id !== product.id).slice(0, 10);
  // Solo reseñas de ESTE diseño (Google no permite reutilizar reseñas de
  // otros productos en el JSON-LD).
  const productReviews = approvedReviews.filter((r) => r.productId === product.id);
  const reviewJsonLd = buildProductReviewJsonLd(productReviews);
  const productUrl = `${SITE_URL}/producto/${product.id}`;
  const mainAlt = product.name
    ? `Cuadro de ${product.name}, en vinilo sobre madera`
    : `Cuadro personalizado categoría ${label}, en vinilo sobre madera`;
  const galleryImages = getProductGalleryImages(product, mainAlt);
  const categoryObj = ESTUDIO_CATEGORIES.find((c) => c.id === product.category);
  const breadcrumbs = [
    { name: "Inicio", path: "/" },
    ...(categoryObj
      ? [{ name: getCategorySeo(categoryObj).h1, path: `/categoria/${categoryObj.id}` }]
      : []),
    { name: productDisplayTitle(product, label), path: `/producto/${product.id}` },
  ];
  // aggregateRating/review SOLO si hay reseñas reales aprobadas de este
  // producto (buildProductReviewJsonLd devuelve null con 0) — nunca
  // estrellas inventadas (ver app/lib/reviewModeration.js). sku = id del catálogo, el
  // mismo que usa el feed de Google Merchant (app/feed/google.xml) para
  // que Merchant Center pueda cruzar ambos.
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: productDisplayTitle(product, label),
    description: productDisplayDescription(product, label),
    image: [`${SITE_URL}/api/catalog-thumbnail/${product.mockupFileId}`],
    url: productUrl,
    sku: product.id,
    category: label,
    material: "Vinilo sobre madera",
    brand: { "@type": "Brand", name: "Mystery Cuadros" },
    ...(reviewJsonLd || {}),
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "COP",
      // Precio de la variante que la página muestra por defecto (40x50
      // Premium) — el mismo del feed de Merchant Center
      // (app/lib/googleFeed.js). Google marca "precio no coincide" si el
      // JSON-LD, la página y el feed dicen cosas distintas; el "Desde"
      // del título sigue usando el más barato.
      price: String(FEED_DEFAULT_PRICE_COP),
      itemCondition: "https://schema.org/NewCondition",
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "Mystery Cuadros" },
      // Política REAL (/politicas, app/lib/legalContent.js — aprobado por
      // el dueño, oct 2026): producto personalizado, NO se aceptan
      // devoluciones por cambio de opinión; solo se responde por defectos
      // de fábrica, daños en el transporte, diseño equivocado o mala
      // impresión (reportados en los primeros días con fotos). Por eso
      // MerchantReturnNotPermitted, sin merchantReturnDays ni returnFees
      // (no hay ventana de devolución voluntaria), y sin itemDefectReturn*
      // porque la política escrita no fija plazo exacto ni quién paga el
      // envío de un defecto — no inventar términos. merchantReturnLink
      // apunta al texto completo.
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "CO",
        returnPolicyCountry: "CO",
        returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
        merchantReturnLink: `${SITE_URL}/politicas`,
      },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: "0",
          currency: "COP",
        },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "CO",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          // Dato del dueño (oct 2026): producción 1-2 días y máximo 5
          // días desde el pedido hasta el cliente en Colombia → tránsito
          // 1-3 días para que el total nunca pase de 5.
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: 1,
            maxValue: 2,
            unitCode: "DAY",
          },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: 1,
            maxValue: 3,
            unitCode: "DAY",
          },
          // La transportadora no entrega los domingos (dato del dueño).
          businessDays: {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: [
              "https://schema.org/Monday",
              "https://schema.org/Tuesday",
              "https://schema.org/Wednesday",
              "https://schema.org/Thursday",
              "https://schema.org/Friday",
              "https://schema.org/Saturday",
            ],
          },
        },
      },
    },
  };

  return (
    <>
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
    <div className="tienda relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[#8fcaf0] text-[#1b2a4a]">
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/walls/fondo-cielo-2.webp)" }}
      />
      {/* Cabecera compacta en móvil (oct 2026): menos padding arriba y
          "volver" + migas de pan en una sola fila (la miga del producto se
          corta con "…", el nombre completo está en el h1) → la foto sube
          ~90px. pb-24 en móvil deja sitio a la barra fija de abajo.
          Escritorio (oct 2026): desde md el contenedor se abre a max-w-6xl
          (mismo ancho que el Home) y la parte de arriba pasa a 2 columnas:
          galería + "Así se ve en tu pared" a la izquierda (sticky) y
          título/precio/CTA/detalles a la derecha. Los wrappers nuevos son
          flex-col gap-6, así que en celular orden y espaciado no cambian. */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-24 pt-4 sm:px-6 sm:py-16 md:max-w-6xl">
        <div className="-mb-2 flex items-center gap-3 sm:mb-0 sm:flex-col sm:items-start sm:gap-6">
          <Link
            href="/"
            className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full border border-black/10 bg-[#fffaf0] px-3 py-1.5 text-xs font-medium text-[#33456b] shadow-sm transition-colors hover:border-accent hover:text-[#1b2a4a] sm:gap-1.5 sm:px-4 sm:py-2 sm:text-sm"
          >
            ← <span className="sm:hidden">Catálogo</span><span className="hidden sm:inline">Volver al catálogo</span>
          </Link>
          <div className="min-w-0 flex-1 [&_[aria-current]]:truncate [&_li:first-child]:shrink-0 [&_li]:min-w-0 [&_li_a]:truncate [&_ol]:flex-nowrap [&_ol]:overflow-hidden [&_ol]:whitespace-nowrap sm:[&_ol]:flex-wrap sm:[&_ol]:whitespace-normal">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        </div>

        <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-8 lg:gap-12">
        <div className="flex flex-col gap-6 md:sticky md:top-8">
        {/* Galería con miniaturas (diseño + fotos reales de acabado) — ver
            app/lib/productGallery.js para agregar fotos. */}
        <ProductGallery
          images={galleryImages}
          sizes="(min-width: 1152px) 528px, (min-width: 768px) 46vw, (min-width: 640px) 448px, 100vw"
        />

        {/* "Así se ve en tu pared": reutiliza la misma miniatura ?w=900 que
            ya cargó la página (sin descarga nueva) y recorta el diseño del
            centro del mockup — /estudio siempre lo pone centrado al 58% del
            ancho en 4:5 (DESIGN_WIDTH_RATIO en EstudioApp.jsx). */}
        <WallVisualizerButton
          imageSrc={`/api/catalog-thumbnail/${product.mockupFileId}?w=900`}
          crop={MOCKUP_DESIGN_CROP}
          imageRatio={40 / 50}
          sizes={CATALOG_SIZES.map((s) => ({ id: s.id, label: s.label }))}
          initialSizeId="40x50"
          className="-mt-3 self-center"
        />
        </div>

        <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          {categoryObj ? (
            <Link
              href={`/categoria/${categoryObj.id}`}
              className="w-fit rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent hover:bg-accent/25"
            >
              {label}
            </Link>
          ) : (
            <span className="w-fit rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
              {label}
            </span>
          )}
          {/* Nombre del producto siempre en Geist (regla tipográfica, ver
              app/globals.css): los nombres suelen pasar de 4 palabras. */}
          <h1 className="text-balance text-2xl font-bold tracking-tight md:text-3xl">
            {productDisplayTitle(product, label)}
          </h1>
          <p className="text-sm text-[#33456b]">{productDisplayDescription(product, label)}</p>
        </div>

        {/* Ancla de la barra fija de móvil (ProductStickyBar). El selector
            en sí no cambia. */}
        <div id="elegir-tamano" className="scroll-mt-4">
          <ProductSizeSelector product={product} />
        </div>

        {/* Fecha estimada calculada en el navegador con la fecha de hoy
            (Bogotá), saltando domingos y festivos — ver DeliveryEstimate. */}
        <DeliveryEstimate />

        {/* Ficha armada con atributos reales (catálogo + SIZES/FRAME_TYPES
            de app/lib/order.js) — da contenido único y útil a cada
            producto, cuya descripción generada por IA es corta. */}
        <section className="rounded-2xl border border-black/5 bg-[#fffaf0] p-5 shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)]">
          <h2 className="font-display mb-3 text-base">Detalles del cuadro</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-[#5b6b8c]">Diseño</dt>
            <dd className="text-[#1b2a4a]">{product.name || `Cuadro de ${label}`}</dd>
            <dt className="text-[#5b6b8c]">Categoría</dt>
            <dd className="text-[#1b2a4a]">{label}</dd>
            <dt className="text-[#5b6b8c]">Material</dt>
            <dd className="text-[#1b2a4a]">Vinilo impreso sobre madera</dd>
            <dt className="text-[#5b6b8c]">Tamaños</dt>
            <dd className="text-[#1b2a4a]">{CATALOG_SIZES.map((s) => s.label).join(" · ")}</dd>
            <dt className="text-[#5b6b8c]">Tipos</dt>
            <dd className="text-[#1b2a4a]">
              {Object.values(FRAME_TYPES)
                .map((t) => `${t.label} (${t.description.charAt(0).toLowerCase()}${t.description.slice(1)})`)
                .join(" · ")}
            </dd>
            <dt className="text-[#5b6b8c]">Precio</dt>
            <dd className="text-[#1b2a4a]">
              Desde {formatCOP(CHEAPEST_PRICE_COP)} hasta{" "}
              {formatCOP(Math.max(...CATALOG_SIZES.map((s) => getPriceCOP(s.id, "premium"))))}
            </dd>
            <dt className="text-[#5b6b8c]">Envío</dt>
            <dd className="text-[#1b2a4a]">Gratis a toda Colombia · hecho en 1-2 días, llega en máximo 5 días (sin domingos)</dd>
            <dt className="text-[#5b6b8c]">Pago</dt>
            <dd className="text-[#1b2a4a]">Wompi (tarjeta, PSE, Nequi o Daviplata vía PSE) o contraentrega</dd>
          </dl>
          <p className="mt-4 text-sm text-[#33456b]">
            ¿Lo quieres con tu propia foto?{" "}
            <Link href="/crear" className="font-semibold text-accent underline-offset-4 hover:underline">
              Crea tu cuadro personalizado
            </Link>
            .
          </p>
        </section>
        </div>
        </div>

        <ProductReviews reviews={productReviews} />

        {sameCategory.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className={`${headingFont(`Más cuadros de ${label}`)} text-base font-bold md:text-lg`}>Más cuadros de {label}</h2>
            <ProductScroller items={sameCategory} light thumbWidth={480} desktopGrid={5} />
          </section>
        )}

        <RelatedLinks
          title="También te puede interesar"
          links={[
            ...(categoryObj
              ? [{ href: `/categoria/${categoryObj.id}`, label: `Ver todos: ${getCategorySeo(categoryObj).h1}` }]
              : []),
            ...(categoryObj ? getCategorySeo(categoryObj).relatedLandings : ["personalizados-con-fotos"])
              .map(getLandingPage)
              .filter(Boolean)
              .map((l) => ({ href: `/cuadros/${l.slug}`, label: l.navLabel })),
          ]}
        />
      </div>
      <ProductStickyBar targetId="elegir-tamano" label={`Elegir tamaño · desde ${formatCOP(CHEAPEST_PRICE_COP)}`} />
    </div>
    </>
  );
}
