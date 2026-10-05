import { formatCOP, getPriceCOP } from "./order";

// Textos SEO por categoría (oct 2026) — separados de
// app/lib/estudioCategories.js a propósito: ese archivo lo usa /estudio
// (carpetas de Drive) y no debería cambiar cada vez que se ajusta un
// título para Google. Los títulos/H1/descripciones se escribieron a partir
// de las búsquedas reales que ya traen impresiones en Search Console
// (ej. "cuadros musicales personalizados", "cuadros de musica", "arte
// abstracto personalizado", "cuadros de anime") y de los diseños que
// realmente hay en cada categoría — nunca prometer algo que no esté ya
// en el sitio (envío gratis, vinilo sobre madera, 3 tamaños de catálogo).

// Precio más bajo real del catálogo (30x40 Tradicional) — sale de
// PRICES, nunca un número fijo, para que no quede desactualizado.
export const CATALOG_FROM_PRICE = formatCOP(getPriceCOP("30x40", "tradicional"));

export const CATEGORY_SEO = {
  abstracto: {
    title: "Cuadros Abstractos y Pop Art Personalizados | Mystery Cuadros",
    h1: "Cuadros abstractos y pop art personalizados",
    metaDescription: `Cuadros abstractos y pop art en vinilo sobre madera para sala, cuarto u oficina. Elige un diseño o crea el tuyo con tu foto. Desde ${CATALOG_FROM_PRICE}, envío gratis en Colombia.`,
    intro:
      "Arte abstracto, pop art y diseños de colores fuertes para darle personalidad a tu sala, tu cuarto o tu oficina: desde el Monopoly Man y retratos pop art hasta perros, gatos y animales en versión moderna. Todos se imprimen en vinilo sobre madera en 30x40, 40x50 o 50x70 cm.",
  },
  anime: {
    title: "Cuadros de Anime en Madera para tu Cuarto | Mystery Cuadros",
    h1: "Cuadros de anime y animación",
    metaDescription: `Cuadros de anime decorativos en vinilo sobre madera: Death Note, Avatar: La Leyenda de Aang y más. Ideales para cuarto o setup gamer. Desde ${CATALOG_FROM_PRICE}, envío gratis en Colombia.`,
    intro:
      "Cuadros decorativos de anime y animación para fans: Light y Ryuk de Death Note, Aang, Toph y el grupo de Avatar: La Leyenda de Aang, Invincible y más personajes. Perfectos para el cuarto o el setup gamer, impresos en vinilo sobre madera.",
  },
  deportes: {
    title: "Cuadros de Fútbol y Deportes en Madera | Mystery Cuadros",
    h1: "Cuadros de fútbol y deportes",
    metaDescription: `Cuadros de fútbol, baloncesto y deportes en vinilo sobre madera: Cristiano Ronaldo, Barcelona, Real Madrid, Chicago Bulls y más. Desde ${CATALOG_FROM_PRICE}, envío gratis en Colombia.`,
    intro:
      "Cuadros deportivos para fanáticos del fútbol y el baloncesto: Cristiano Ronaldo, jugadores del FC Barcelona, Real Madrid, Brasil y los Chicago Bulls, además de celebraciones y campeones con la copa. Un regalo seguro para cualquier hincha.",
  },
  iconic: {
    title: "Cuadros Icónicos y de Cultura Pop | Mystery Cuadros",
    h1: "Cuadros icónicos y de cultura pop",
    metaDescription: `Cuadros con íconos de la cultura pop en vinilo sobre madera: Tyson, Walter White, astronautas y más. Diseños con actitud para tu pared. Desde ${CATALOG_FROM_PRICE}, envío gratis en Colombia.`,
    intro:
      "Íconos y referencias que marcaron una época, en diseños llamativos: Tyson, Walter White de Breaking Bad, el astronauta en la luna, boxeadores y más. Para quienes quieren una pared con actitud.",
  },
  musica: {
    title: "Cuadros de Música y Musicales Personalizados | Mystery Cuadros",
    h1: "Cuadros de música personalizados",
    metaDescription: `Cuadros musicales de tus artistas favoritos en vinilo sobre madera: Feid (Ferxxo), Drake, Billie Eilish, Juice WRLD y más, o personaliza el tuyo. Desde ${CATALOG_FROM_PRICE}, envío gratis en Colombia.`,
    intro:
      "Cuadros musicales con tus artistas favoritos —Ferxxo, Drake, Billie Eilish, Juice WRLD, Snoop Dogg, Trueno, A$AP Rocky y más— en retratos y pósters de estilo urbano y pop art. ¿Quieres la portada de tu álbum favorito o una foto de tu concierto? Créalo tú mismo con tu imagen.",
  },
  "peliculas-series": {
    title: "Cuadros de Películas y Series en Madera | Mystery Cuadros",
    h1: "Cuadros de películas y series",
    metaDescription: `Cuadros de películas y series en vinilo sobre madera: Spider-Man, Batman, El Padrino, Breaking Bad, Volver al Futuro y más. Desde ${CATALOG_FROM_PRICE}, envío gratis en Colombia.`,
    intro:
      "Tus películas y series favoritas en la pared: Spider-Man y Miles Morales, Batman, El Padrino, Volver al Futuro, Breaking Bad, The Boys, Rick y Morty, BoJack Horseman y más. Pósters y escenas en vinilo sobre madera.",
  },
  "mystery-disenos": {
    title: "Diseños Originales Mystery — Cuadros Únicos | Mystery Cuadros",
    h1: "Diseños originales Mystery",
    metaDescription: `Cuadros con diseños 100% originales de Mystery, que no vas a encontrar en otro lado: "La Buena Mi Rey", "A Marte Más No Pude" y más. Desde ${CATALOG_FROM_PRICE}, envío gratis en Colombia.`,
    intro:
      "Piezas creadas 100% por Mystery, con sabor colombiano: \"La Buena Mi Rey\", \"A Marte Más No Pude\", el vendedor ambulante, \"Juguito de Amor Propio\" y paisajes urbanos de noche estrellada.",
  },
};

export function getCategorySeo(category) {
  const seo = CATEGORY_SEO[category.id] || {};
  return {
    title: seo.title || `Cuadros de ${category.label} Personalizados | Mystery Cuadros`,
    h1: seo.h1 || `Cuadros de ${category.label}`,
    metaDescription: seo.metaDescription || category.description,
    intro: seo.intro || null,
  };
}
