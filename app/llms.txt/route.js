import { ESTUDIO_CATEGORIES } from "../lib/estudioCategories";
import { getCategorySeo } from "../lib/categorySeo";
import { LANDING_PAGES } from "../lib/landingPages";
import { CATALOG_SIZES, SIZES, PRICES, formatCOP } from "../lib/order";
import { SITE_URL } from "../lib/siteUrl";

// /llms.txt (oct 2026): resumen en Markdown de la tienda para asistentes
// de IA (ChatGPT, Perplexity, Copilot, Claude) que lo leen al buscar
// "dónde comprar cuadros personalizados en Colombia". Google dice que no
// lo usa para posicionar; es barato y no estorba. Precios y tamaños salen
// de app/lib/order.js y los enlaces de las mismas listas que el sitemap,
// así nunca queda desactualizado. Mismas reglas que las landings: nada
// que no esté ya escrito en el sitio.
export const revalidate = 3600;

function priceLine(size) {
  const premium = PRICES.premium[size.id];
  const tradicional = PRICES.tradicional[size.id];
  const parts = [`Premium ${formatCOP(premium)}`];
  if (tradicional) parts.push(`Tradicional ${formatCOP(tradicional)}`);
  return `- ${size.label}: ${parts.join(" · ")}`;
}

export function GET() {
  const customSizes = SIZES.filter((s) => s.customOnly);
  const lines = [
    "# Mystery Cuadros",
    "",
    "> Tienda online colombiana de cuadros en vinilo impreso sobre madera: cuadros personalizados con la foto del cliente y diseños de catálogo (música, anime, películas y series, deportes, abstracto y más). Envío gratis a toda Colombia.",
    "",
    "## Cómo funciona",
    "",
    `- El cliente sube su foto desde el celular en ${SITE_URL}/crear, la ajusta dentro del marco, elige tamaño y paga en línea.`,
    "- Se imprime en vinilo laminado sobre madera (no es pintado a mano) y llega listo para colgar.",
    "- Dos tipos: Premium (marco trasero de 3 cm que lo separa de la pared) y Tradicional (más delgado, con soporte para colgar).",
    "- Producción en 1 a 2 días; llega en máximo 5 días después de confirmar el pedido (la transportadora no entrega los domingos).",
    "- Pagos con Wompi: tarjeta de crédito o débito, PSE, Nequi y Daviplata. También contraentrega con un anticipo de $20.000 y un recargo de $5.000 por el recaudo.",
    "- Producto personalizado: no se aceptan devoluciones por cambio de opinión; sí se responde por defectos de fábrica, daños en el transporte, diseño equivocado o mala impresión.",
    "",
    "## Tamaños y precios (COP, envío incluido)",
    "",
    ...CATALOG_SIZES.map(priceLine),
    ...customSizes.map((size) => `${priceLine(size)} (solo con foto propia en /crear)`),
    "",
    "## Categorías del catálogo",
    "",
    ...ESTUDIO_CATEGORIES.map((category) => {
      const seo = getCategorySeo(category);
      return `- [${seo.h1}](${SITE_URL}/categoria/${category.id}): ${seo.metaDescription}`;
    }),
    "",
    "## Guías e ideas",
    "",
    ...LANDING_PAGES.map((page) => `- [${page.h1}](${SITE_URL}/cuadros/${page.slug}): ${page.metaDescription}`),
    "",
    "## Información",
    "",
    `- [Crear un cuadro con tu foto](${SITE_URL}/crear)`,
    `- [Estado de un pedido](${SITE_URL}/pedido)`,
    `- [Políticas de envío, cambios y privacidad](${SITE_URL}/politicas)`,
    "- Atención por WhatsApp: +57 320 264 6716",
    "- Instagram: https://www.instagram.com/bigmystery_/",
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
