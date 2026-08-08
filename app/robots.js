// /estudio es una herramienta interna (generador de mockups para
// Instagram, uso del diseñador) — nunca debe indexarse ni aparecer en
// buscadores. No está enlazada desde ningún menú, pero por si acaso se
// comparte o se filtra la URL, la desautorizamos explícitamente acá.
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/estudio",
    },
  };
}
