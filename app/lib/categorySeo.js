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
    body: [
      "El arte abstracto y el pop art funcionan en casi cualquier espacio porque no dependen de un tema: aportan color, forma y textura. Los diseños con fondos claros y tonos suaves (como el tablero de ajedrez ondulado o la tipografía minimalista) van bien en salas y comedores tranquilos; los de colores saturados (Monopoly Man, retratos pop art, el perro con paleta de helado) son ideales para darle carácter a un cuarto, un estudio o una oficina.",
      "Si buscas un cuadro abstracto para la sala, el 50x70 cm suele quedar proporcionado sobre un sofá; para combinar dos o tres piezas en una misma pared, el 30x40 o el 40x50 cm."
    ],
    relatedCategories: ["mystery-disenos", "iconic"],
    relatedLandings: ["para-sala", "de-mascotas"],
  },
  anime: {
    // oct 7 2026: /categoria/anime sale en posición 50-90 para "cuadros de
    // anime", "cuadros decorativos anime" y "venta de cuadros de anime" con
    // solo ~365 palabras en la página. Título/H1 con "decorativos" (la
    // búsqueda real) y más texto útil sobre los diseños, tamaños, cómo se
    // hacen (impresos, no pintados a mano — alguien lo buscó así) y envío.
    title: "Cuadros de Anime Decorativos en Madera | Mystery Cuadros",
    h1: "Cuadros decorativos de anime y animación",
    metaDescription: `Cuadros de anime decorativos en vinilo sobre madera: Death Note, Avatar: La Leyenda de Aang, Invincible y más, o crea el de tu anime favorito. Desde ${CATALOG_FROM_PRICE}, envío gratis a toda Colombia.`,
    intro:
      "Cuadros decorativos de anime y animación para fans: Light y Ryuk de Death Note, Aang, Toph y el grupo de Avatar: La Leyenda de Aang, Invincible y más personajes. Perfectos para el cuarto o el setup gamer, impresos en vinilo sobre madera.",
    body: [
      "En esta colección hay diseños de Death Note (Light y Ryuk en versión split face), varios de Avatar: La Leyenda de Aang (Aang dominando el aire, Aang como maestro del aire, Toph Beifong y el grupo principal), Invincible y personajes de estilo anime como el de cabello rojo intenso o el ángel oscuro de alas negras.",
      "Para un setup gamer, dos o tres cuadros de 30x40 cm del mismo anime arman una pared temática; para la cabecera de la cama o la pared principal del cuarto, un 50x70 cm.",
      "¿Son pintados a mano? No: cada cuadro se imprime en vinilo laminado de alta calidad sobre madera, así los colores y los detalles del dibujo original quedan nítidos, y llega listo para colgar. El envío es gratis a toda Colombia.",
      "¿Tu anime favorito no está todavía? Puedes crear el cuadro tú mismo subiendo la imagen que quieras en el editor: un personaje, una escena o el póster de tu serie."
    ],
    relatedCategories: ["peliculas-series", "iconic"],
    relatedLandings: ["regalo-navidad-pareja", "regalo-de-navidad-personalizado"],
  },
  deportes: {
    title: "Cuadros de Fútbol y Deportes en Madera | Mystery Cuadros",
    h1: "Cuadros de fútbol y deportes",
    metaDescription: `Cuadros de fútbol, baloncesto y deportes en vinilo sobre madera: Cristiano Ronaldo, Barcelona, Real Madrid, Chicago Bulls y más. Desde ${CATALOG_FROM_PRICE}, envío gratis en Colombia.`,
    intro:
      "Cuadros deportivos para fanáticos del fútbol y el baloncesto: Cristiano Ronaldo, jugadores del FC Barcelona, Real Madrid, Brasil y los Chicago Bulls, además de celebraciones y campeones con la copa. Un regalo seguro para cualquier hincha.",
    body: [
      "Para el hincha del fútbol o el fan del baloncesto: cuadros de Cristiano Ronaldo, jugadores del FC Barcelona, Real Madrid y Brasil, los Chicago Bulls y celebraciones de campeones. Un cuadro deportivo es un regalo seguro para papás, hermanos, amigos o para el cuarto de un niño fanático.",
      "Si prefieres la foto de tu propio equipo, de un partido en el estadio o de tu hijo con la camiseta, súbela en el editor y la imprimimos en el tamaño que elijas."
    ],
    relatedCategories: ["iconic", "musica"],
    relatedLandings: ["regalo-navidad-mama-papa", "regalo-de-navidad-personalizado"],
  },
  iconic: {
    title: "Cuadros Icónicos y de Cultura Pop | Mystery Cuadros",
    h1: "Cuadros icónicos y de cultura pop",
    metaDescription: `Cuadros con íconos de la cultura pop en vinilo sobre madera: Tyson, Walter White, astronautas y más. Diseños con actitud para tu pared. Desde ${CATALOG_FROM_PRICE}, envío gratis en Colombia.`,
    intro:
      "Íconos y referencias que marcaron una época, en diseños llamativos: Tyson, Walter White de Breaking Bad, el astronauta en la luna, boxeadores y más. Para quienes quieren una pared con actitud.",
    body: [
      "Iconic reúne personajes y referencias de la cultura pop con mucha actitud: Mike Tyson, Walter White, astronautas, boxeadores y retratos vintage. Son diseños pensados para ser protagonistas de una pared, en un estudio, una barbería, un local o un cuarto con estilo urbano."
    ],
    relatedCategories: ["peliculas-series", "abstracto"],
    relatedLandings: ["para-sala", "regalo-de-navidad-personalizado"],
  },
  musica: {
    title: "Cuadros de Música y Musicales Personalizados | Mystery Cuadros",
    h1: "Cuadros de música personalizados",
    metaDescription: `Cuadros musicales de tus artistas favoritos en vinilo sobre madera: Feid (Ferxxo), Drake, Billie Eilish, Juice WRLD y más, o personaliza el tuyo. Desde ${CATALOG_FROM_PRICE}, envío gratis en Colombia.`,
    intro:
      "Cuadros musicales con tus artistas favoritos —Ferxxo, Drake, Billie Eilish, Juice WRLD, Snoop Dogg, Trueno, A$AP Rocky y más— en retratos y pósters de estilo urbano y pop art. ¿Quieres la portada de tu álbum favorito o una foto de tu concierto? Créalo tú mismo con tu imagen.",
    body: [
      "Los cuadros musicales son una forma de mostrar en la pared lo que suena en tu casa: retratos y pósters de artistas urbanos, reggaetón, rap y pop como Ferxxo, Drake, Billie Eilish, Juice WRLD, Snoop Dogg, Pharrell Williams, Trueno y A$AP Rocky.",
      "¿Buscas un cuadro de música personalizado? Sube la portada de tu álbum favorito, una foto de tu concierto o de tu banda, y la imprimimos en vinilo sobre madera."
    ],
    relatedCategories: ["iconic", "peliculas-series"],
    relatedLandings: ["regalo-navidad-pareja", "personalizados-con-fotos"],
  },
  "peliculas-series": {
    title: "Cuadros de Películas y Series en Madera | Mystery Cuadros",
    h1: "Cuadros de películas y series",
    metaDescription: `Cuadros de películas y series en vinilo sobre madera: Spider-Man, Batman, El Padrino, Breaking Bad, Volver al Futuro y más. Desde ${CATALOG_FROM_PRICE}, envío gratis en Colombia.`,
    intro:
      "Tus películas y series favoritas en la pared: Spider-Man y Miles Morales, Batman, El Padrino, Volver al Futuro, Breaking Bad, The Boys, Rick y Morty, BoJack Horseman y más. Pósters y escenas en vinilo sobre madera.",
    body: [
      "Para los fans del cine y las series: superhéroes como Spider-Man, Miles Morales, Batman y Wolverine; clásicos como El Padrino y Volver al Futuro; y series como Breaking Bad, The Boys, Rick y Morty y BoJack Horseman.",
      "Quedan muy bien en el cuarto, en la sala de TV o en un home theater. Si la escena que quieres no está, puedes crearla tú mismo con tu propia imagen."
    ],
    relatedCategories: ["anime", "iconic"],
    relatedLandings: ["regalo-navidad-pareja", "regalo-de-navidad-personalizado"],
  },
  "mystery-disenos": {
    title: "Diseños Originales Mystery — Cuadros Únicos | Mystery Cuadros",
    h1: "Diseños originales Mystery",
    metaDescription: `Cuadros con diseños 100% originales de Mystery, que no vas a encontrar en otro lado: "La Buena Mi Rey", "A Marte Más No Pude" y más. Desde ${CATALOG_FROM_PRICE}, envío gratis en Colombia.`,
    intro:
      "Piezas creadas 100% por Mystery, con sabor colombiano: \"La Buena Mi Rey\", \"A Marte Más No Pude\", el vendedor ambulante, \"Juguito de Amor Propio\" y paisajes urbanos de noche estrellada.",
    body: [
      "Diseños creados por el equipo de Mystery, muchos con sabor colombiano: frases como \"La Buena Mi Rey\" o \"A Marte Más No Pude\", el vendedor ambulante, paisajes urbanos de noche estrellada y astronautas. Son piezas que no vas a encontrar en otra tienda."
    ],
    relatedCategories: ["abstracto", "iconic"],
    relatedLandings: ["para-sala", "personalizados-con-fotos"],
  },
};

export function getCategorySeo(category) {
  const seo = CATEGORY_SEO[category.id] || {};
  return {
    title: seo.title || `Cuadros de ${category.label} Personalizados | Mystery Cuadros`,
    h1: seo.h1 || `Cuadros de ${category.label}`,
    metaDescription: seo.metaDescription || category.description,
    intro: seo.intro || null,
    body: seo.body || [],
    relatedCategories: seo.relatedCategories || [],
    relatedLandings: seo.relatedLandings || [],
  };
}
