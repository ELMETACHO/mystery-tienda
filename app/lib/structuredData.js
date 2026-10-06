import { SITE_URL } from "./siteUrl";

// Helpers de datos estructurados (schema.org JSON-LD) compartidos entre
// /categoria/[slug], /producto/[id] y las landings de /cuadros/* (oct
// 2026). Regla: solo marcar lo que el usuario ve en la página — nada de
// aggregateRating/review salvo reseñas reales APROBADAS de ESE producto
// (/producto/[id] las agrega vía buildProductReviewJsonLd en
// app/lib/reviewModeration.js; las de /crear son de la tienda, no de un
// diseño, y no van en ningún JSON-LD).

// items: [{ name, path }] en orden, desde "Inicio". path relativo ("/",
// "/categoria/musica") — se vuelve absoluto con SITE_URL, que es lo que
// pide Google.
export function breadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

// Página de listado (categoría/landing) con sus productos reales como
// ItemList — ListItem con solo url/name (patrón "summary page" de Google
// para carruseles), sin repetir el Product completo de cada diseño.
export function collectionPageJsonLd({ name, description, path, products }) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url: absoluteUrl(path),
    inLanguage: "es-CO",
    isPartOf: { "@type": "WebSite", name: "Mystery Cuadros", url: SITE_URL },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/producto/${product.id}`),
        name: product.name ? `Cuadro ${product.name}` : "Cuadro personalizado",
      })),
    },
  };
}

// FAQPage SOLO para preguntas que se muestran tal cual en la página
// (Google exige que el contenido marcado sea visible).
export function faqPageJsonLd(faq) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.pregunta,
      acceptedAnswer: { "@type": "Answer", text: item.respuesta },
    })),
  };
}

export function absoluteUrl(path) {
  if (!path || path === "/") return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

// `<` escapado para que un nombre/descripción con "</script>" nunca pueda
// cerrar la etiqueta antes de tiempo (los textos de producto los genera
// una IA, no se controlan a mano).
export function JsonLd({ data }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
