// Landings de intención de compra (oct 2026) — servidas por
// app/cuadros/[slug]/page.js, enlazadas desde el Home/footer e incluidas en
// app/sitemap.js. Los temas salen de búsquedas reales en Colombia (Google
// Suggest con gl=co + Search Console), ver BITACORA.md.
//
// REGLAS (no romperlas al editar):
// - Nada inventado: sin reseñas, cifras de ventas, ni promesas de entrega
//   que no estén ya en el sitio. Precios y tamaños salen siempre de
//   app/lib/order.js (la página los arma, acá no se escriben números).
// - La fecha límite de Navidad vive SOLO en app/lib/christmas.js
//   (`christmas: true` la muestra en esa landing).
// - Las FAQ se muestran visibles en la página y SOLO por eso se marcan
//   como FAQPage.
// - `productMatch` elige ejemplos reales del catálogo (Redis) por
//   palabras en el nombre/descripción o por categoría; si no hay
//   coincidencias, la sección de ejemplos simplemente no se muestra.

const FAQ_FOTO = {
  pregunta: "¿Qué foto sirve para un cuadro personalizado?",
  respuesta:
    "Entre mejor calidad tenga tu foto, mejor se verá en la pared: usa la original (no una captura de pantalla ni una foto reenviada muchas veces por WhatsApp), con buena luz y bien enfocada. Puedes subir PNG, JPG, HEIC (iPhone) o PDF. Antes de imprimir revisamos tu foto con ayuda de IA y nuestro equipo la revisa antes de producir el cuadro.",
};

const FAQ_PAGO = {
  pregunta: "¿Cómo puedo pagar?",
  respuesta:
    "Pagas de forma segura con Wompi: tarjeta de crédito o débito, PSE, y Nequi o Daviplata (se pagan desde PSE; también con QR o llaves). También puedes pagar contraentrega con un anticipo de $20.000 y el resto al recibir el cuadro.",
};

const FAQ_ENVIO = {
  pregunta: "¿Cuánto se demora y cuánto cuesta el envío?",
  respuesta:
    "El envío es gratis a toda Colombia. Lo hacemos en 1 a 2 días y te llega en máximo 5 días después de confirmar el pedido (la transportadora no entrega los domingos).",
};

const FAQ_DANO = {
  pregunta: "¿Qué pasa si mi cuadro llega dañado?",
  respuesta:
    "Si llega con un defecto de fábrica, dañado por el transporte, con el diseño equivocado o con mala calidad de impresión, repórtalo en los primeros días con fotos como evidencia y lo solucionamos.",
};

const FAQ_TIPOS = {
  pregunta: "¿Qué diferencia hay entre Premium y Tradicional?",
  respuesta:
    "Los dos son vinilo impreso sobre madera. El Premium tiene un marco trasero de 3 cm que lo separa de la pared; el Tradicional es más delgado y trae soporte para colgar, y es la opción más económica.",
};

export const LANDING_PAGES = [
  {
    slug: "personalizados-con-fotos",
    navLabel: "Cuadros personalizados con fotos",
    title: "Cuadros Personalizados con Fotos en Colombia | Mystery Cuadros",
    metaDescription:
      "Convierte tu foto en un cuadro personalizado en vinilo sobre madera. Súbela desde el celular, elige tamaño y recíbelo con envío gratis en Bogotá, Medellín, Cali y toda Colombia.",
    h1: "Cuadros personalizados con tus fotos",
    lead:
      "Sube tu foto desde el celular, ajústala dentro del marco y elige el tamaño. La imprimimos en vinilo sobre madera y te la enviamos gratis a cualquier ciudad de Colombia.",
    sections: [
      {
        heading: "Tu foto, impresa en vinilo sobre madera",
        paragraphs: [
          "Un cuadro personalizado con foto es la forma más directa de llevar un recuerdo a la pared: la foto de tu familia, tu pareja, tu mascota, un viaje o un grado. En Mystery no usamos plantillas: el cuadro es exactamente la foto que tú subes, con el encuadre que tú eliges en el editor.",
          "Puedes elegir entre dos tipos: Premium, con marco trasero de 3 cm que lo separa de la pared, y Tradicional, más delgado y con soporte para colgar.",
        ],
      },
      {
        heading: "Qué tamaño elegir",
        paragraphs: [
          "El 30x40 cm funciona bien en mesas de noche, escritorios y paredes pequeñas. El 40x50 cm es el más elegido: se ve bien en casi cualquier pared de cuarto o pasillo. El 50x70 cm es para ser protagonista en la sala o el comedor, y si buscas algo realmente grande, en el editor también encuentras 70x100 y 100x140 cm (solo Premium).",
          "En el editor ves una silueta de persona a escala junto a cada tamaño, para que te hagas una idea real antes de pagar.",
        ],
      },
      {
        heading: "Envíos a toda Colombia",
        paragraphs: [
          "Hacemos envíos gratis a Bogotá, Medellín, Cali, Barranquilla, Bucaramanga, Pereira, Manizales y al resto del país. No tienes que ir a ningún local ni buscar una tienda de cuadros personalizados cerca de ti: todo se hace desde el celular.",
        ],
      },
      {
        heading: "Ideas para tu cuadro",
        bullets: [
          "Foto de pareja para un aniversario o para decorar el cuarto.",
          "Foto familiar para la sala o para regalarles a los papás.",
          "Tu mascota, en una foto donde se le vea bien la carita.",
          "Una foto de cumpleaños, grado o viaje que no quieres que se quede en el celular.",
          "Un collage o una foto con frase: ármalo primero en tu celular (por ejemplo con una app de collage) y sube la imagen terminada.",
        ],
      },
    ],
    productMatch: { categories: ["mystery-disenos", "abstracto"], limit: 12 },
    examplesHeading: "¿Prefieres un diseño listo? Mira algunos del catálogo",
    faq: [FAQ_FOTO, FAQ_TIPOS, FAQ_ENVIO, FAQ_PAGO, FAQ_DANO],
    related: ["regalo-de-navidad-personalizado", "regalo-aniversario", "de-mascotas", "para-sala"],
    relatedCategories: ["mystery-disenos", "abstracto", "musica"],
  },
  {
    slug: "regalo-de-navidad-personalizado",
    christmas: true,
    navLabel: "Regalos de Navidad personalizados",
    title: "Regalo de Navidad Personalizado: Cuadro con tu Foto | Mystery Cuadros",
    metaDescription:
      "¿Buscas un regalo de Navidad personalizado? Un cuadro con una foto que signifique algo, en vinilo sobre madera. Lo creas desde el celular y llega con envío gratis a toda Colombia.",
    h1: "Regalo de Navidad personalizado: un cuadro con su foto",
    lead:
      "Este diciembre regala algo que no se encuentra en ningún centro comercial: un cuadro con una foto que tenga historia. Lo creas en un par de minutos desde el celular y te llega a la casa.",
    sections: [
      {
        heading: "Por qué un cuadro es un buen regalo de Navidad",
        paragraphs: [
          "La mayoría de regalos de Navidad se olvidan en enero. Un cuadro con una foto de la familia, de la pareja o de un momento compartido se queda en la pared todo el año, y cada vez que lo ven se acuerdan de quién se lo dio.",
          "Además sirve para casi cualquier persona: mamá, papá, abuelos, pareja, hermanos, amigos o el amigo secreto de la oficina.",
        ],
      },
      {
        heading: "Ideas de regalo según la persona",
        bullets: [
          "Para mamá o papá: la foto de la familia completa, o una foto vieja de ellos jóvenes.",
          "Para tu pareja: la foto de su primer viaje, de su primera Navidad juntos o la que más les guste a los dos.",
          "Para los abuelos: una foto con todos los nietos.",
          "Para un amigo: una foto del parche, de un concierto o de su equipo favorito (en el catálogo hay diseños de fútbol, música y series).",
          "Para el amigo secreto: un diseño del catálogo, según sus gustos, si no tienes una foto con esa persona.",
        ],
      },
      {
        heading: "Cuánto cuesta",
        paragraphs: [
          "Los precios dependen del tamaño y del tipo de cuadro, y el envío a toda Colombia es gratis. Abajo tienes la tabla completa: el 30x40 cm Tradicional es la opción más económica para un detalle, y el 40x50 cm es el tamaño más elegido para regalar.",
        ],
      },
    ],
    productMatch: { categories: ["mystery-disenos", "musica", "deportes", "peliculas-series"], limit: 12 },
    examplesHeading: "Diseños del catálogo para regalar",
    faq: [
      {
        pregunta: "¿Hasta cuándo puedo pedir para que llegue antes de Navidad?",
        respuesta:
          "Lo hacemos en 1 a 2 días y te llega en máximo 5 días después de confirmar el pedido (la transportadora no entrega los domingos), así que en diciembre pide con tiempo.",
        // La página le agrega el mensaje de app/lib/christmas.js mientras
        // esté vigente (y lo quita solo cuando vence).
        christmasDeadline: true,
      },
      FAQ_FOTO,
      FAQ_ENVIO,
      FAQ_PAGO,
      FAQ_DANO,
    ],
    related: ["regalo-navidad-mama-papa", "regalo-navidad-pareja", "personalizados-con-fotos", "de-mascotas"],
    relatedCategories: ["deportes", "musica", "peliculas-series"],
  },
  {
    slug: "regalo-navidad-mama-papa",
    christmas: true,
    navLabel: "Regalo de Navidad para mamá y papá",
    title: "Regalo de Navidad para Mamá y Papá: Cuadro con Foto | Mystery Cuadros",
    metaDescription:
      "Ideas de regalo de Navidad para tu mamá, tu papá o los dos: un cuadro personalizado con una foto familiar, en vinilo sobre madera. Envío gratis a toda Colombia.",
    h1: "Regalo de Navidad para mamá y papá",
    lead:
      "A los papás casi nunca les hace falta nada… excepto ver a la familia en la pared. Un cuadro con una foto familiar es un regalo de Navidad sencillo de hacer y que de verdad usan.",
    sections: [
      {
        heading: "Ideas de foto para un cuadro para mamá",
        bullets: [
          "Una foto tuya (o de todos los hijos) con ella.",
          "Una foto antigua de ella cuando era joven: si solo la tienes impresa, tómale una foto con buena luz y sin reflejos.",
          "La foto de la familia completa en la última reunión.",
          "Si ya es abuela: la foto con todos los nietos.",
        ],
      },
      {
        heading: "Ideas de foto para un cuadro para papá",
        bullets: [
          "Una foto juntos haciendo lo que más le gusta: el fútbol, la finca, un viaje.",
          "La foto del día de su matrimonio, si se la regalan entre hermanos.",
          "Una foto con su nieto o nieta.",
          "Si es muy hincha, también hay diseños de fútbol listos en el catálogo.",
        ],
      },
      {
        heading: "Un regalo para los dos",
        paragraphs: [
          "Si quieres regalarles a los dos al tiempo, una foto de ellos en pareja o de la familia completa en 50x70 cm queda muy bien en la sala. Si la idea es para su cuarto o una pared más pequeña, el 40x50 cm es el más elegido.",
        ],
      },
    ],
    productMatch: { categories: ["deportes", "iconic"], limit: 10 },
    examplesHeading: "Diseños listos para papás hinchas y fans",
    faq: [FAQ_FOTO, FAQ_TIPOS, FAQ_ENVIO, FAQ_PAGO],
    related: ["regalo-de-navidad-personalizado", "regalo-navidad-pareja", "personalizados-con-fotos", "para-sala"],
    relatedCategories: ["deportes", "iconic", "musica"],
  },
  {
    slug: "regalo-navidad-pareja",
    christmas: true,
    navLabel: "Regalo de Navidad para tu pareja",
    title: "Regalo de Navidad para tu Novio, Novia o Pareja | Mystery Cuadros",
    metaDescription:
      "Regalo de Navidad original para tu novio, novia, esposo o esposa: un cuadro personalizado con su foto favorita, en vinilo sobre madera. Lo creas desde el celular, envío gratis en Colombia.",
    h1: "Regalo de Navidad para tu pareja",
    lead:
      "¿No sabes qué regalarle a tu novio, novia, esposo o esposa en Navidad? Un cuadro con la foto que más les gusta a los dos es un regalo original, personal y que se queda a la vista todo el año.",
    sections: [
      {
        heading: "Ideas de cuadro para tu pareja",
        bullets: [
          "La foto de su primera Navidad juntos (o de la primera salida).",
          "Esa foto de viaje que siempre dicen que van a imprimir y nunca imprimen.",
          "Una foto de los dos con su mascota.",
          "Si le encanta un artista, una serie o un equipo, un diseño del catálogo: hay de música, películas y series, anime y deportes.",
        ],
      },
      {
        heading: "Para novio y para novia",
        paragraphs: [
          "Para un novio o esposo funcionan muy bien las fotos de un momento compartido o un diseño de lo que le apasiona (fútbol, música, una película). Para una novia o esposa, una foto en pareja que a ella le guste mucho suele ser el acierto seguro.",
          "Un consejo: elige una foto donde los dos se vean bien y no muy oscura; en el editor puedes acercar y mover la imagen para quitar lo que sobre.",
        ],
      },
    ],
    productMatch: { keywords: ["pareja", "luna"], categories: ["musica", "peliculas-series"], limit: 10 },
    examplesHeading: "Diseños del catálogo para regalarle a tu pareja",
    faq: [FAQ_FOTO, FAQ_TIPOS, FAQ_ENVIO, FAQ_PAGO],
    related: ["regalo-aniversario", "regalo-de-navidad-personalizado", "regalo-navidad-mama-papa", "personalizados-con-fotos"],
    relatedCategories: ["musica", "peliculas-series", "anime"],
  },
  {
    slug: "regalo-aniversario",
    navLabel: "Cuadro de aniversario",
    title: "Cuadro de Aniversario Personalizado con Foto | Mystery Cuadros",
    metaDescription:
      "Regalo de aniversario para tu pareja: un cuadro personalizado con su foto en vinilo sobre madera. Para novios, aniversario de 1 año o de bodas. Envío gratis a toda Colombia.",
    h1: "Cuadro de aniversario personalizado",
    lead:
      "Ya sea el primer año de novios o un aniversario de bodas, un cuadro con su foto es un regalo de aniversario que se queda a la vista todos los días, no en un cajón.",
    sections: [
      {
        heading: "Ideas de foto para el aniversario",
        bullets: [
          "Aniversario de 1 año: la foto de su primera cita o de su primer viaje.",
          "Aniversario de bodas: una foto del matrimonio, o una foto actual de los dos para comparar con la de ese día.",
          "Una selfie que les encante a los dos: si es del celular, que sea la original y no una captura.",
          "Aniversario de padres: un cuadro de ellos dos, como regalo de los hijos.",
        ],
      },
      {
        heading: "¿Y si quiero poner una frase o la fecha?",
        paragraphs: [
          "El editor imprime la imagen tal como la subes. Si quieres que el cuadro tenga una frase, sus nombres o la fecha, agrégala primero a la foto en tu celular (cualquier app de edición de fotos sirve) y sube la imagen ya terminada.",
        ],
      },
      {
        heading: "Qué tamaño regalar",
        paragraphs: [
          "Para el cuarto o la mesa de noche, 30x40 o 40x50 cm. Si van a ponerlo en la sala, 50x70 cm o más grande; en el editor también encuentras 70x100 y 100x140 cm (solo Premium).",
        ],
      },
    ],
    productMatch: { keywords: ["pareja", "luna", "amor"], limit: 8 },
    examplesHeading: "Diseños del catálogo con temática de pareja",
    faq: [FAQ_FOTO, FAQ_TIPOS, FAQ_ENVIO, FAQ_PAGO, FAQ_DANO],
    related: ["regalo-navidad-pareja", "personalizados-con-fotos", "para-sala", "de-mascotas"],
    relatedCategories: ["mystery-disenos", "peliculas-series", "musica"],
  },
  {
    slug: "para-sala",
    navLabel: "Cuadros para sala",
    title: "Cuadros para Sala Modernos y Personalizados | Mystery Cuadros",
    metaDescription:
      "Cuadros para sala modernos en vinilo sobre madera: abstractos, pop art, diseños originales o con tu propia foto. Tamaños hasta 100x140 cm, envío gratis a toda Colombia.",
    h1: "Cuadros para sala modernos y personalizados",
    lead:
      "La sala es la pared que más se ve de la casa. Elige un diseño moderno del catálogo o convierte tu foto favorita en el cuadro principal de la sala.",
    sections: [
      {
        heading: "Cómo elegir el tamaño del cuadro para la sala",
        paragraphs: [
          "Una regla práctica: sobre un sofá, el cuadro (o el grupo de cuadros) debería ocupar más o menos dos tercios del ancho del sofá. Para un sofá de tres puestos funciona un 50x70 cm o, si quieres algo protagonista, un 70x100 o 100x140 cm (solo Premium, en el editor).",
          "Para salas pequeñas o paredes estrechas, un 40x50 cm se ve proporcionado. Otra opción es combinar dos o tres cuadros del mismo estilo en 30x40 o 40x50 cm.",
        ],
      },
      {
        heading: "Estilos que funcionan en la sala",
        bullets: [
          "Abstracto y pop art: color y personalidad sin que el cuadro tenga que \"decir\" algo.",
          "Diseños originales Mystery: piezas propias con sabor colombiano.",
          "Una foto familiar o de un viaje en gran formato: el cuadro más personal posible.",
          "Para el comedor, algo más tranquilo y minimalista.",
        ],
      },
      {
        heading: "Premium o Tradicional para la sala",
        paragraphs: [
          "El Premium tiene un marco trasero de 3 cm que lo despega de la pared y le da más presencia; es el que recomendamos para el cuadro principal. El Tradicional es más delgado, con soporte para colgar, y es la opción más económica.",
        ],
      },
    ],
    productMatch: { categories: ["abstracto", "mystery-disenos"], limit: 14 },
    examplesHeading: "Diseños para sala del catálogo",
    faq: [FAQ_TIPOS, FAQ_FOTO, FAQ_ENVIO, FAQ_PAGO],
    related: ["personalizados-con-fotos", "regalo-aniversario", "de-mascotas", "regalo-navidad-mama-papa"],
    relatedCategories: ["abstracto", "mystery-disenos", "iconic"],
  },
  {
    slug: "de-mascotas",
    navLabel: "Cuadros de mascotas",
    title: "Cuadro de Mascota Personalizado con su Foto | Mystery Cuadros",
    metaDescription:
      "Cuadro personalizado de tu perro o gato con su foto, en vinilo sobre madera. También como recuerdo de una mascota que ya no está. Envío gratis a toda Colombia.",
    h1: "Cuadros de mascotas personalizados",
    lead:
      "Tu perro, tu gato o cualquier mascota de la familia, en un cuadro con su propia foto. Lo creas desde el celular en un par de minutos.",
    sections: [
      {
        heading: "Cómo elegir la foto de tu mascota",
        bullets: [
          "Que se le vea bien la carita y los ojos: a su altura queda mejor que desde arriba.",
          "Con luz natural (cerca de una ventana o al aire libre) y sin movimiento.",
          "La foto original del celular, no una captura de pantalla ni una foto reenviada por WhatsApp.",
          "En el editor puedes acercar y mover la foto para que la mascota quede centrada.",
        ],
      },
      {
        heading: "Un recuerdo de una mascota que ya no está",
        paragraphs: [
          "Muchas personas hacen un cuadro como recuerdo de una mascota que falleció. Si es tu caso, busca la foto con mejor calidad que tengas; antes de imprimir revisamos la foto con ayuda de IA y nuestro equipo, para que el resultado sea el mejor posible con esa imagen.",
        ],
      },
      {
        heading: "Para regalar",
        paragraphs: [
          "Un cuadro de su mascota es un regalo seguro para cualquier persona que ame a su perro o gato: de cumpleaños, de Navidad o simplemente porque sí.",
        ],
      },
    ],
    productMatch: {
      keywords: ["perro", "gato", "husky", "dálmata", "doberman", "salchicha", "caballo"],
      limit: 14,
    },
    examplesHeading: "Diseños de animales del catálogo",
    faq: [FAQ_FOTO, FAQ_TIPOS, FAQ_ENVIO, FAQ_PAGO],
    related: ["personalizados-con-fotos", "regalo-de-navidad-personalizado", "para-sala", "regalo-aniversario"],
    relatedCategories: ["abstracto", "mystery-disenos", "iconic"],
  },
];

export function getLandingPage(slug) {
  return LANDING_PAGES.find((page) => page.slug === slug) || null;
}

// Elige productos reales del catálogo para la sección de ejemplos:
// primero los que coinciden por palabra clave (nombre/descripción), luego
// los de las categorías indicadas, sin repetir, más nuevos primero.
export function pickLandingProducts(products, match = {}) {
  const { keywords = [], categories = [], limit = 12 } = match;
  const sorted = [...products].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const seen = new Set();
  const picked = [];
  const add = (p) => {
    if (picked.length >= limit || seen.has(p.id)) return;
    seen.add(p.id);
    picked.push(p);
  };

  if (keywords.length) {
    const pattern = new RegExp(`\\b(${keywords.join("|")})`, "i");
    sorted.filter((p) => pattern.test(`${p.name || ""} ${p.description || ""}`)).forEach(add);
  }
  if (categories.length) {
    sorted.filter((p) => categories.includes(p.category)).forEach(add);
  }
  return picked;
}
