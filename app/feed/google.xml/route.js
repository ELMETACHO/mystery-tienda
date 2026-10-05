import { getCatalogProducts } from "../../lib/catalog";
import { buildGoogleFeedXml } from "../../lib/googleFeed";

// Feed de productos para Google Merchant Center (RSS 2.0 + namespace g:),
// oct 2026. URL: /feed/google.xml — el dueño la registra en Merchant Center
// como "fuente de datos programada" (no se envía nada desde acá).
//
// Un ítem por diseño del catálogo, en la variante que /producto/[id] muestra
// por defecto al entrar (40x50 Premium, ver ProductSizeSelector.jsx): Google
// exige que el precio del feed coincida con el que ve el cliente al abrir el
// link, y la página todavía no permite preseleccionar otro tamaño por URL.
// Si eso cambia, se pueden agregar las otras tallas como variantes con
// item_group_id.
//
// Solo Colombia: envío gratis (lo que dice el sitio), producción 1-2 días y
// máximo 5 días hasta el cliente (dato del dueño, oct 2026).

export const dynamic = "force-dynamic";

export async function GET() {
  const xml = buildGoogleFeedXml(await getCatalogProducts());

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Merchant Center lo descarga 1 vez al día; una hora de caché en el
      // edge evita leer Redis en cada petición.
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "X-Robots-Tag": "noindex",
    },
  });
}
