// Categorías de diseño en /estudio → carpeta destino en Drive. Compartido
// entre el cliente (EstudioApp.jsx, para mostrar los chips) y el servidor
// (api/estudio-upload-drive, para resolver a qué carpeta sube cada
// archivo) — así el ID de carpeta real nunca lo decide el cliente.
export const ESTUDIO_CATEGORIES = [
  {
    id: "abstracto",
    label: "Abstracto",
    folderId: "1HcIT5_GPCdH70SH8cnrUcQimuPpQugid",
    description:
      "Cuadros abstractos personalizados con formas, colores y texturas modernas — ideales para darle un toque artístico y contemporáneo a cualquier espacio.",
    coverImage: "/images/categorias/abstracto.jpg",
  },
  {
    id: "anime",
    label: "Ánime",
    folderId: "1vXqXPiQfOX6S68mT-ccjBEbowlSdhp-K",
    description:
      "Cuadros con tus personajes de ánime favoritos, personalizados en vinilo sobre madera — perfectos para fans que quieren decorar su cuarto o espacio gamer.",
    coverImage: "/images/categorias/anime.jpg",
  },
  {
    id: "deportes",
    label: "Deportes",
    folderId: "1LgPMdBK9WrjnQ3F2xpwwXK18RB9jyzbF",
    description:
      "Cuadros deportivos personalizados con tus equipos, jugadores o momentos favoritos — un regalo ideal para cualquier fanático del deporte.",
    coverImage: "/images/categorias/deportes.jpg",
  },
  {
    id: "iconic",
    label: "Iconic",
    folderId: "19mUJZaRcFi2Q4xPerMnKVH-T6yvLoiGH",
    description:
      "Cuadros con íconos, personajes y referencias culturales que marcaron una época — diseños llamativos para quienes quieren un estilo único en su pared.",
    coverImage: "/images/categorias/iconic.jpg",
  },
  {
    id: "musica",
    label: "Música",
    folderId: "1TUmSFSMw1RU5X0xs-gpDwiDTwAJdD6WO",
    description:
      "Cuadros inspirados en tus artistas, álbumes o géneros musicales favoritos — la forma perfecta de mostrar tu pasión por la música en casa.",
    coverImage: "/images/categorias/musica.jpg",
  },
  {
    id: "peliculas-series",
    label: "Películas y Series",
    folderId: "1UOj14w7stMY78yJej6hwsRGjRTtf4u78",
    description:
      "Cuadros de tus películas y series favoritas, con escenas, personajes o pósters icónicos — para revivir tus historias favoritas cada vez que los veas.",
    coverImage: "/images/categorias/series y películas.jpg",
  },
  {
    id: "mystery-disenos",
    label: "Mystery Diseños",
    folderId: "1jYePNEyyv0FMFhgURlplKWRaE2pBNDxj",
    description:
      "Diseños originales creados 100% por Mystery — piezas propias, sin referencias de terceros, para quienes buscan algo único que no van a encontrar en ningún otro lado.",
    coverImage: "/images/categorias/mystery-disenos.png",
  },
];

export function getCategoryFolderId(categoryId) {
  const category = ESTUDIO_CATEGORIES.find((c) => c.id === categoryId);
  return category?.folderId || null;
}
