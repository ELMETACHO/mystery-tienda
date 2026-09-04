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
  },
  {
    id: "anime",
    label: "Ánime",
    folderId: "1vXqXPiQfOX6S68mT-ccjBEbowlSdhp-K",
    description:
      "Cuadros con tus personajes de ánime favoritos, personalizados en vinilo sobre madera — perfectos para fans que quieren decorar su cuarto o espacio gamer.",
  },
  {
    id: "deportes",
    label: "Deportes",
    folderId: "1LgPMdBK9WrjnQ3F2xpwwXK18RB9jyzbF",
    description:
      "Cuadros deportivos personalizados con tus equipos, jugadores o momentos favoritos — un regalo ideal para cualquier fanático del deporte.",
  },
  {
    id: "iconic",
    label: "Iconic",
    folderId: "19mUJZaRcFi2Q4xPerMnKVH-T6yvLoiGH",
    description:
      "Cuadros con íconos, personajes y referencias culturales que marcaron una época — diseños llamativos para quienes quieren un estilo único en su pared.",
  },
  {
    id: "musica",
    label: "Música",
    folderId: "1TUmSFSMw1RU5X0xs-gpDwiDTwAJdD6WO",
    description:
      "Cuadros inspirados en tus artistas, álbumes o géneros musicales favoritos — la forma perfecta de mostrar tu pasión por la música en casa.",
  },
  {
    id: "peliculas-series",
    label: "Películas y Series",
    folderId: "1UOj14w7stMY78yJej6hwsRGjRTtf4u78",
    description:
      "Cuadros de tus películas y series favoritas, con escenas, personajes o pósters icónicos — para revivir tus historias favoritas cada vez que los veas.",
  },
];

export function getCategoryFolderId(categoryId) {
  const category = ESTUDIO_CATEGORIES.find((c) => c.id === categoryId);
  return category?.folderId || null;
}
