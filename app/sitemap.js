import { getCatalogProducts } from "./lib/catalog";
import { ESTUDIO_CATEGORIES } from "./lib/estudioCategories";

const SITE_URL =
  process.env.SITE_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://tienda.elmetacho.com");

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
export default async function sitemap() {
  const now = new Date();
  const products = await getCatalogProducts();

  const staticRoutes = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/crear`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/politicas`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/referidos`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const categoryRoutes = ESTUDIO_CATEGORIES.map((category) => ({
    url: `${SITE_URL}/categoria/${category.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const productRoutes = products.map((product) => ({
    url: `${SITE_URL}/producto/${product.id}`,
    lastModified: product.uploadedAt ? new Date(product.uploadedAt) : now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
