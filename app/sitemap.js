import { getCatalogProducts } from "./lib/catalog";
import { ESTUDIO_CATEGORIES } from "./lib/estudioCategories";
import { SITE_URL } from "./lib/siteUrl";
import { LANDING_PAGES } from "./lib/landingPages";

// Sin esto, Next.js prerenderiza el sitemap como estático en build time
// (no usa cookies/headers, así que lo optimiza por defecto) y quedaría
// con el catálogo congelado a la fecha del último deploy en vez de
// reflejar los productos reales — mismo motivo que force-dynamic en
// app/page.js.
export const dynamic = "force-dynamic";

// Solo rutas públicas pensadas para indexarse — /estudio, /admin, /fabricante
// y demás paneles internos quedan fuera a propósito. Categorías y
// productos se generan dinámicamente contra el catálogo real (Redis) en
// vez de una lista fija, así el sitemap se actualiza solo cada vez que se
// sube un diseño nuevo desde /estudio, sin tocar este archivo de nuevo.
// Fecha real del último cambio de contenido/plantilla de cada tipo de
// página. Antes todo salía con lastmod = "ahora" en cada visita, y Google
// aprende a ignorar un lastmod que siempre cambia — así nunca sabía que
// /categoria/musica (rastreada por última vez el 20 sep) tenía textos
// nuevos. Al cambiar los textos o la plantilla de un tipo de página,
// actualizar su fecha aquí.
const CONTENT_UPDATED = {
  home: "2026-10-05",
  crear: "2026-10-05",
  politicas: "2026-10-05",
  referidos: "2026-10-05",
  landings: "2026-10-05",
  categories: "2026-10-05",
  products: "2026-10-05",
};

function latest(...dates) {
  const valid = dates
    .filter(Boolean)
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()));
  return valid.length ? new Date(Math.max(...valid.map((d) => d.getTime()))) : undefined;
}

export default async function sitemap() {
  const products = await getCatalogProducts();

  // Diseño más reciente de cada categoría: si se sube uno nuevo desde
  // /estudio, la categoría (y la Home, que muestra los últimos) cambian
  // de verdad y su lastmod debe reflejarlo.
  const newestByCategory = {};
  let newestProduct;
  for (const product of products) {
    if (!product.uploadedAt) continue;
    newestProduct = latest(newestProduct, product.uploadedAt);
    newestByCategory[product.category] = latest(newestByCategory[product.category], product.uploadedAt);
  }

  const staticRoutes = [
    { url: `${SITE_URL}/`, lastModified: latest(CONTENT_UPDATED.home, newestProduct), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/crear`, lastModified: latest(CONTENT_UPDATED.crear), changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/politicas`, lastModified: latest(CONTENT_UPDATED.politicas), changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/referidos`, lastModified: latest(CONTENT_UPDATED.referidos), changeFrequency: "monthly", priority: 0.5 },
  ];

  // Landings de intención de compra (app/lib/landingPages.js) — prioridad
  // alta: son las páginas pensadas para entrar desde Google.
  const landingRoutes = LANDING_PAGES.map((page) => ({
    url: `${SITE_URL}/cuadros/${page.slug}`,
    lastModified: latest(CONTENT_UPDATED.landings),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const categoryRoutes = ESTUDIO_CATEGORIES.map((category) => ({
    url: `${SITE_URL}/categoria/${category.id}`,
    lastModified: latest(CONTENT_UPDATED.categories, newestByCategory[category.id]),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const productRoutes = products.map((product) => ({
    url: `${SITE_URL}/producto/${product.id}`,
    lastModified: latest(CONTENT_UPDATED.products, product.uploadedAt),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...landingRoutes, ...categoryRoutes, ...productRoutes];
}
