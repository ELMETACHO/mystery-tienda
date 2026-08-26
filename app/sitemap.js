const SITE_URL =
  process.env.SITE_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://tienda.elmetacho.com");

// Solo rutas públicas pensadas para indexarse — /estudio, /admin, /fabricante
// y demás paneles internos quedan fuera a propósito.
export default function sitemap() {
  const now = new Date();

  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/crear`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/politicas`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/referidos`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
