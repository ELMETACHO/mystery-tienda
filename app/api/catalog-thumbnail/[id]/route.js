import { getCatalogProducts } from "../../../lib/catalog";
import { downloadFileBuffer } from "../../../lib/googleDrive";

// Sirve las miniaturas del catálogo desde NUESTRO propio dominio, en vez
// de que el navegador del cliente pida directo a drive.google.com/thumbnail.
//
// Por qué: ese endpoint de Drive es una vista previa interna, no un CDN
// pensado para servir imágenes públicas a escala — su comportamiento es
// inconsistente según la red/dispositivo del visitante (confirmado:
// fallaba de forma reproducible en un iPhone con iCloud Private Relay,
// mientras funcionaba bien en otros). Acá descargamos el archivo UNA
// SOLA VEZ con nuestras propias credenciales OAuth2 (mismo cliente que
// usa /estudio, ver app/lib/googleDrive.js — autenticado, nunca depende
// del permiso público "cualquiera con el enlace" ni de cookies de
// sesión de Google del visitante) y lo cacheamos de forma agresiva en el
// edge de Vercel: el visitante nunca vuelve a tocar Drive.
//
// `unoptimized` en los <Image> que consumen esta ruta (ver
// ProductGrid.jsx y producto/[id]/page.js) evita que esto además pase
// por el optimizador de imágenes de Vercel, que tiene una cuota
// gratuita mensual limitada (ver commit anterior — ya se agotó dos
// veces con las miniaturas del catálogo).
//
// El id se valida contra el catálogo real (debe ser el mockupFileId de
// ALGÚN producto existente) antes de pedirle nada a Drive — sin esto,
// esta ruta sería un proxy abierto que cualquiera podría usar para
// descargar cualquier archivo de nuestro Drive con solo adivinar un id.
// Versiones reducidas (oct 2026, rendimiento móvil): los mockups
// originales son PNG de ~3 MB cada uno y el Home cargaba ~40 MB de
// miniaturas. Con `?w=480` (y opcional `&f=jpg`) se sirve una copia
// redimensionada en WebP/JPEG (~30-80 KB). Solo anchos de esta lista, para
// no multiplicar las variantes cacheadas. SIN `w` la respuesta es
// exactamente la de siempre (PNG original) — así /fabricante, /ads y
// cualquier uso existente no cambian.
const ALLOWED_WIDTHS = new Set([320, 480, 640, 900, 1200]);

async function resizeImage(buffer, width, format) {
  // Import dinámico: sharp ya viene con Next (optimizador de imágenes). Si
  // por algún motivo no carga en el entorno, se devuelve el original en
  // vez de romper la imagen.
  try {
    const sharp = (await import("sharp")).default;
    const pipeline = sharp(buffer).rotate().resize({ width, withoutEnlargement: true });
    if (format === "jpg") {
      return { body: await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer(), type: "image/jpeg" };
    }
    return { body: await pipeline.webp({ quality: 78 }).toBuffer(), type: "image/webp" };
  } catch (err) {
    console.error("[catalog-thumbnail] No se pudo redimensionar, se sirve el original:", err);
    return null;
  }
}

export async function GET(request, { params }) {
  const { id } = await params;
  const searchParams = new URL(request.url).searchParams;
  const width = Number(searchParams.get("w"));
  const format = searchParams.get("f") === "jpg" ? "jpg" : "webp";

  const products = await getCatalogProducts();
  const isKnownMockup = products.some((p) => p.mockupFileId === id);
  if (!isKnownMockup) {
    return new Response("No encontrado", { status: 404 });
  }

  let buffer;
  try {
    buffer = await downloadFileBuffer(id);
  } catch (err) {
    console.error(`[catalog-thumbnail] No se pudo descargar ${id} de Drive:`, err);
    return new Response("No se pudo obtener la imagen", { status: 502 });
  }

  let body = buffer;
  let contentType = "image/png";
  if (ALLOWED_WIDTHS.has(width)) {
    const resized = await resizeImage(buffer, width, format);
    if (resized) {
      body = resized.body;
      contentType = resized.type;
    }
  }

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      // Inmutable: el mockup de un producto nunca cambia una vez subido
      // (subir un diseño nuevo genera un id de archivo distinto), así
      // que el navegador y el edge de Vercel pueden cachearlo para
      // siempre sin volver a pedirlo.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
