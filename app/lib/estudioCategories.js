// Categorías de diseño en /estudio → carpeta destino en Drive. Compartido
// entre el cliente (EstudioApp.jsx, para mostrar los chips) y el servidor
// (api/estudio-upload-drive, para resolver a qué carpeta sube cada
// archivo) — así el ID de carpeta real nunca lo decide el cliente.
export const ESTUDIO_CATEGORIES = [
  { id: "abstracto", label: "Abstracto", folderId: "1HcIT5_GPCdH70SH8cnrUcQimuPpQugid" },
  { id: "anime", label: "Ánime", folderId: "1vXqXPiQfOX6S68mT-ccjBEbowlSdhp-K" },
  { id: "deportes", label: "Deportes", folderId: "1LgPMdBK9WrjnQ3F2xpwwXK18RB9jyzbF" },
  { id: "iconic", label: "Iconic", folderId: "19mUJZaRcFi2Q4xPerMnKVH-T6yvLoiGH" },
  { id: "musica", label: "Música", folderId: "1TUmSFSMw1RU5X0xs-gpDwiDTwAJdD6WO" },
  { id: "peliculas-series", label: "Películas y Series", folderId: "1UOj14w7stMY78yJej6hwsRGjRTtf4u78" },
];

export function getCategoryFolderId(categoryId) {
  const category = ESTUDIO_CATEGORIES.find((c) => c.id === categoryId);
  return category?.folderId || null;
}
