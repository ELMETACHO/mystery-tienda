// Textos de /ads por temporada (octubre 2026). Un solo lugar para pasar de
// "temporada normal" a "Navidad" (o volver) sin tocar el diseño de la
// página — ver ADS.md, sección "Temporadas en /ads".
//
// Cómo se elige la temporada de cada visita (en este orden):
//   1. Parámetro en la URL del anuncio: /ads?temporada=navidad (o ?t=navidad).
//      Permite que un anuncio navideño y uno normal convivan al mismo tiempo,
//      cada uno con su landing coherente (message match).
//   2. utm_campaign que contenga "navidad"/"christmas"/"xmas" (si la URL del
//      anuncio usa la macro de nombre de campaña de TikTok).
//   3. Variable de entorno ADS_TEMPORADA ("navidad" | "regular") en Vercel —
//      cambia la temporada por defecto de toda la página (requiere Redeploy).
//   4. TEMPORADA_POR_DEFECTO de este archivo.
//
// REGLA: nada de urgencia inventada (ver ADS.md, ronda 3 — Ley 1480 y
// políticas de TikTok). La fecha límite de Navidad es REAL (la dio el
// dueño, oct 2026: producción 1-2 días, máximo 5 días hasta el cliente) y
// desaparece sola cuando pasa.

export const TEMPORADA_POR_DEFECTO = "regular";

// ── Fecha límite de Navidad ────────────────────────────────────────────
// Único lugar para cambiarla. Formato "AAAA-MM-DD". El aviso se muestra
// hasta el final de NAVIDAD.fechaLimite (hora Colombia) y se oculta solo
// desde el día siguiente. null en fechaLimite = no se muestra nunca.
//  - En temporada "navidad" el aviso sale siempre (hasta la fecha límite).
//  - En temporada "regular" sale automáticamente desde mostrarDesde.
export const NAVIDAD = {
  fechaLimite: "2026-12-17",
  mostrarDesde: "2026-11-01",
  aviso: "🎄 Pide hasta el 17 de diciembre para recibir antes del 24",
  avisoCorto: "🎄 Pide hasta el 17 dic y recíbelo antes del 24",
  fraseFaq: "Para Navidad: pide hasta el 17 de diciembre para recibirlo antes del 24.",
};

export const TEMPORADAS = {
  regular: {
    id: "regular",
    barra: "🚚 Envío gratis a todo el país · 💵 Paga al recibir",
    titulo: "Tu foto favorita, en un cuadro real",
    subtitulo: "Vinilo laminado sobre madera, listo para colgar.",
    cta: "📷 Sube tu foto y mira cómo queda",
    tituloFlujo: "Tu cuadro con cualquier imagen",
  },
  navidad: {
    id: "navidad",
    barra: "🎄 Regalo de Navidad · 🚚 Envío gratis · 💵 Paga al recibir",
    titulo: "Esta Navidad, regala su foto favorita en un cuadro real",
    subtitulo: "Un regalo personalizado en vinilo laminado sobre madera, listo para colgar.",
    cta: "🎁 Sube la foto y mira cómo queda",
    tituloFlujo: "Arma tu regalo con cualquier foto",
  },
};

// Hoy en Colombia (UTC-5, sin horario de verano) como "AAAA-MM-DD".
export function hoyEnColombia(now = Date.now()) {
  return new Date(now - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function esFecha(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// ¿Se muestra hoy el aviso de fecha límite de Navidad?
export function avisoNavidadVigente(temporadaId, hoy = hoyEnColombia()) {
  if (!esFecha(NAVIDAD.fechaLimite) || hoy > NAVIDAD.fechaLimite) return false;
  if (temporadaId === "navidad") return true;
  return esFecha(NAVIDAD.mostrarDesde) && hoy >= NAVIDAD.mostrarDesde;
}

function primerValor(value) {
  return Array.isArray(value) ? value[0] : value;
}

// searchParams: el objeto ya resuelto (await) que recibe la página.
export function resolverTemporada(searchParams = {}) {
  const pedida = String(primerValor(searchParams.temporada) || primerValor(searchParams.t) || "")
    .trim()
    .toLowerCase();
  const campana = String(primerValor(searchParams.utm_campaign) || "");
  const env = String(process.env.ADS_TEMPORADA || "").trim().toLowerCase();

  let id = TEMPORADA_POR_DEFECTO;
  if (TEMPORADAS[pedida]) id = pedida;
  else if (/navidad|christmas|xmas/i.test(campana)) id = "navidad";
  else if (TEMPORADAS[env]) id = env;

  return {
    ...TEMPORADAS[id],
    avisoNavidad: avisoNavidadVigente(id) ? NAVIDAD : null,
  };
}
