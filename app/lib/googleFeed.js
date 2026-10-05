import { ESTUDIO_CATEGORIES } from "./estudioCategories";
import { DEFAULT_FRAME_TYPE, FRAME_TYPES, getPriceCOP } from "./order";
import { SITE_URL } from "./siteUrl";

// Armado del feed de Google Merchant Center (ver app/feed/google.xml/route.js).
const FEED_SIZE_ID = "40x50";
const FEED_FRAME_TYPE = DEFAULT_FRAME_TYPE;
// Google product taxonomy: Home & Garden > Decor > Artwork > Posters,
// Prints, & Visual Artwork.
const GOOGLE_PRODUCT_CATEGORY = "500044";

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Caracteres de control que invalidan el XML.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function tag(name, value) {
  return `<${name}>${xmlEscape(value)}</${name}>`;
}

function buildGoogleFeedItem(product) {
  const label = ESTUDIO_CATEGORIES.find((c) => c.id === product.category)?.label || "Diseño";
  const price = getPriceCOP(FEED_SIZE_ID, FEED_FRAME_TYPE);
  const frame = FRAME_TYPES[FEED_FRAME_TYPE];
  const baseTitle = product.name ? `Cuadro ${product.name}` : `Cuadro Personalizado ${label}`;
  const title = `${baseTitle} - Vinilo sobre Madera 40x50 cm`.slice(0, 150);
  const description = [
    product.description || `Cuadro decorativo de ${label} en vinilo sobre madera.`,
    `Tamaño 40x50 cm, versión ${frame.label} (${frame.description.toLowerCase()}).`,
    "También disponible en 30x40 y 50x70 cm, en versión Premium o Tradicional.",
    "Envío gratis a toda Colombia.",
  ].join(" ");

  return [
    "<item>",
    tag("g:id", product.id),
    tag("g:title", title),
    tag("g:description", description.slice(0, 5000)),
    tag("g:link", `${SITE_URL}/producto/${product.id}`),
    tag("g:image_link", `${SITE_URL}/api/catalog-thumbnail/${product.mockupFileId}?w=1200&f=jpg`),
    tag("g:availability", "in_stock"),
    tag("g:price", `${price} COP`),
    tag("g:brand", "Mystery Cuadros"),
    tag("g:condition", "new"),
    tag("g:identifier_exists", "no"),
    tag("g:google_product_category", GOOGLE_PRODUCT_CATEGORY),
    tag("g:product_type", `Cuadros > ${label}`),
    tag("g:size", "40x50 cm"),
    tag("g:material", "Vinilo sobre madera"),
    tag("g:custom_label_0", product.category || "sin-categoria"),
    "<g:shipping>",
    tag("g:country", "CO"),
    tag("g:price", "0 COP"),
    tag("g:min_handling_time", "1"),
    tag("g:max_handling_time", "2"),
    tag("g:min_transit_time", "1"),
    tag("g:max_transit_time", "3"),
    "</g:shipping>",
    "</item>",
  ].join("");
}

export function buildGoogleFeedXml(products) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "<channel>",
    tag("title", "Mystery Cuadros — Catálogo"),
    tag("link", `${SITE_URL}/`),
    tag("description", "Cuadros en vinilo sobre madera. Envío gratis a toda Colombia."),
    ...products.filter((p) => p.id && p.mockupFileId).map(buildGoogleFeedItem),
    "</channel>",
    "</rss>",
  ].join("\n");
}

// Precio que /producto/[id] muestra por defecto (y el que declara su
// JSON-LD) — debe ser el mismo del feed.
export const FEED_DEFAULT_PRICE_COP = getPriceCOP(FEED_SIZE_ID, FEED_FRAME_TYPE);
