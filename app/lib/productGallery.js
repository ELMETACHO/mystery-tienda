// Galería de la página de producto (oct 2026).
//
// Orden de las fotos:
//   1. El mockup del diseño (siempre, es la foto principal y el LCP).
//   2. Fotos propias del producto, si el catálogo las trae en
//      `product.galleryImages` (lista de { fileId, kind, alt? } con ids de
//      Drive, servidas por /api/catalog-thumbnail igual que el mockup).
//      Hoy ningún producto las tiene: queda listo para cuando el dueño
//      suba fotos reales por diseño.
//   3. Fotos genéricas de acabado (GENERIC_GALLERY): fotos REALES de otros
//      cuadros colgados, que muestran el borde, la profundidad y cómo se ve
//      en una pared. Se rotulan como "foto real de otro diseño" para no
//      confundir con el diseño que se está comprando.
//
// Para agregar una foto genérica nueva (ej. "en la mano", "comparación de
// tamaños"): poner en public/images/galeria/ un WebP 720×900 (4:5, ≤60KB)
// y su miniatura 128×160 (-thumb.webp), y sumarla abajo con su `kind`.
// La "vista a escala en tu pared" ya existe aparte (WallVisualizerButton,
// debajo de la galería), así que la comparación de tamaños no se repite
// acá con un montaje.

export const GALLERY_KINDS = {
  diseno: "Diseño",
  pared: "En la pared",
  perfil: "De perfil",
  mano: "En la mano",
  escala: "Tamaños",
  regalo: "Para regalar",
};

const GENERIC_GALLERY = [
  {
    src: "/images/galeria/pared-perfil-1.webp",
    thumb: "/images/galeria/pared-perfil-1-thumb.webp",
    kind: "perfil",
    alt: "Foto real de un cuadro Mystery colgado, visto de lado: se ve el borde de madera",
    caption: "Foto real de otro diseño · así se ve el borde y la profundidad",
  },
  {
    src: "/images/galeria/pared-perfil-2.webp",
    thumb: "/images/galeria/pared-perfil-2-thumb.webp",
    kind: "pared",
    alt: "Foto real de un cuadro Mystery colgado en una pared blanca",
    caption: "Foto real de otro diseño · así queda colgado en la pared",
  },
];

export function getProductGalleryImages(product, mainAlt) {
  const main = `/api/catalog-thumbnail/${product.mockupFileId}?w=900`;
  const own = Array.isArray(product.galleryImages)
    ? product.galleryImages
        .filter((img) => img && typeof img.fileId === "string" && img.fileId)
        .slice(0, 6)
        .map((img) => ({
          src: `/api/catalog-thumbnail/${img.fileId}?w=900`,
          thumb: `/api/catalog-thumbnail/${img.fileId}?w=320`,
          kind: GALLERY_KINDS[img.kind] ? img.kind : "pared",
          alt: img.alt || `${mainAlt} — ${GALLERY_KINDS[img.kind] || "foto real"}`,
          caption: null,
        }))
    : [];
  return [
    // La miniatura del diseño reutiliza la misma URL ?w=900 que ya cargó la
    // foto principal (sin descarga extra).
    { src: main, thumb: main, kind: "diseno", alt: mainAlt, caption: null },
    ...own,
    ...GENERIC_GALLERY,
  ];
}
