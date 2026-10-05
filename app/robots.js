// /estudio es una herramienta interna (generador de mockups para
// Instagram, uso del diseñador) — nunca debe indexarse ni aparecer en
// buscadores. No está enlazada desde ningún menú, pero por si acaso se
// comparte o se filtra la URL, la desautorizamos explícitamente acá.
//
// `sitemap` le indica a los buscadores dónde está app/sitemap.js (servido en
// /sitemap.xml), usando el mismo SITE_URL canónico que metadataBase y el
// propio sitemap — así Google/Bing lo descubren sin depender solo de
// Search Console.
import { SITE_URL } from "./lib/siteUrl";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/estudio",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
