import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalogProductById } from "../../lib/catalog";
import { ESTUDIO_CATEGORIES } from "../../lib/estudioCategories";
import { SIZES, getPriceCOP, formatCOP } from "../../lib/order";
import { SITE_URL } from "../../lib/siteUrl";
import ProductSizeSelector from "./ProductSizeSelector";
import Breadcrumbs from "../../components/Breadcrumbs";
import { getCategorySeo } from "../../lib/categorySeo";
import { JsonLd, breadcrumbJsonLd } from "../../lib/structuredData";

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
      images: [{ url: `${SITE_URL}/api/catalog-thumbnail/${product.mockupFileId}` }],
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
  const productUrl = `${SITE_URL}/producto/${product.id}`;
  const categoryObj = ESTUDIO_CATEGORIES.find((c) => c.id === product.category);
  const breadcrumbs = [
    { name: "Inicio", path: "/" },
    ...(categoryObj
      ? [{ name: getCategorySeo(categoryObj).h1, path: `/categoria/${categoryObj.id}` }]
      : []),
    { name: productDisplayTitle(product, label), path: `/producto/${product.id}` },
  ];
  // Sin aggregateRating/review a propósito: no hay reseñas reales por
  // diseño (ver app/lib/structuredData.js). sku = id del catálogo, el
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
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "COP",
      price: String(CHEAPEST_PRICE_COP),
      itemCondition: "https://schema.org/NewCondition",
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "Mystery Cuadros" },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "CO",
        returnPolicyCountry: "CO",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 7,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
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
        },
      },
    },
  };

  return (
    <>
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
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

        <Breadcrumbs items={breadcrumbs} />

        <div
          className="relative w-full overflow-hidden rounded-2xl border border-black/10 shadow-[0_20px_50px_-16px_rgba(30,20,60,0.35)]"
          style={{ aspectRatio: 1080 / 1350 }}
        >
          <Image
            src={`/api/catalog-thumbnail/${product.mockupFileId}`}
            alt={product.name ? `Cuadro de ${product.name}, en vinilo sobre madera` : `Cuadro personalizado categoría ${label}, en vinilo sobre madera`}
            fill
            unoptimized
            sizes="(min-width: 640px) 448px, 100vw"
            className="object-cover"
            priority
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="w-fit rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
            {label}
          </span>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {productDisplayTitle(product, label)}
          </h1>
          <p className="text-sm text-[#33456b]">{productDisplayDescription(product, label)}</p>
        </div>

        <ProductSizeSelector product={product} />

        <p className="text-center text-base font-semibold text-accent">
          Recibe de 3 a 5 días hábiles
        </p>
      </div>
    </div>
    </>
  );
}
