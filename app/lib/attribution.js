// Origen de cada pedido ("¿de dónde llegó este cliente?"), oct 2026.
//
// Cómo funciona, de punta a punta:
// 1. Al aterrizar en la tienda, OriginTracker (componente invisible del
//    layout) lee la URL, el referrer y el navegador interno de la app
//    (Instagram/Facebook/TikTok) y guarda en localStorage el primer toque y
//    el último toque (30 días). Todo síncrono y local: sin red, sin
//    librerías, después de pintar la página.
// 2. El checkout agrega ese objeto chiquito (< 1 KB) a fullOrder, que YA
//    viaja en las peticiones que el checkout manda de todas formas
//    (save-pending-order, confirm-order, confirm-cod-order,
//    confirm-free-order). Ninguna petición nueva, ningún await nuevo.
// 3. El servidor lo limpia (sanitizeAttribution: lista blanca de campos,
//    límites de largo, canal recalculado acá — nunca se confía en la
//    etiqueta que manda el navegador) y lo guarda con el pedido.
// 4. /admin/respaldos y /admin/crm lo muestran como "Origen".
//
// Privacidad: solo se guarda de dónde vino la visita (utm_*, si había un
// click id de anuncio — solo presencia, no el valor —, el dominio del
// referrer y la ruta de aterrizaje sin query string). Nada personal.
//
// Este archivo es SOLO la captura en el navegador (lo mínimo, ~1 KB): la
// clasificación en canales, las etiquetas y la limpieza del lado del
// servidor viven en attributionChannels.js, que el navegador del cliente
// nunca descarga. Sin imports de librerías, usable en node:test.

export const ATTRIBUTION_STORAGE_KEY = "mystery:origen";
export const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// Rutas donde NO se registra un toque nuevo: internas (admin/fabricante/
// estudio), el checkout (al volver de Wompi/PSE el referrer es la
// pasarela, no un canal de venta) y las que usan ?ref= para la referencia
// de un pedido (/pedido, /resena), no para un código de referido.
const SKIP_PATH = /^\/(admin|fabricante|estudio|checkout|pedido|resena|api)(\/|$)/;

// Pasarelas de pago/bancos: si alguna vez llegan como referrer, no son el
// origen del cliente.
const PAYMENT_HOST = /(^|\.)(wompi\.co|wompi\.com|pse\.com\.co|nequi\.com\.co|bancolombia\.com|daviplata\.com|davivienda\.com|bancodebogota\.com|placetopay\.com)$/;

const OWN_HOST = /(^|\.)(mysterycuadros\.com|vercel\.app)$|^(localhost|127\.0\.0\.1)$/;

// Navegador interno de la app desde la que se abrió el enlace (sin
// referrer, es la única pista de que vino de Instagram/Facebook/TikTok).
// Solo se guarda el nombre de la app, nunca el user agent.
export function detectInAppBrowser(userAgent) {
  const ua = String(userAgent || "");
  if (/Instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/.test(ua)) return "facebook";
  if (/musical_ly|BytedanceWebview|TikTok|trill_/i.test(ua)) return "tiktok";
  return "";
}

function referrerHost(referrer) {
  if (!referrer) return "";
  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export const UTM_FIELDS = [
  ["utm_source", "source"],
  ["utm_medium", "medium"],
  ["utm_campaign", "campaign"],
  ["utm_content", "content"],
  ["utm_term", "term"],
];

// Construye el toque de esta visita a partir de la URL de aterrizaje.
// Devuelve { touch, isSignal } — isSignal = trae información de canal
// (utm, click id, ?ref=, referrer externo o app) y por eso debe pasar a
// ser el "último toque". Devuelve null en rutas internas/excluidas.
export function buildTouch({ href, referrer, userAgent, now }) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (SKIP_PATH.test(url.pathname)) return null;

  const p = url.searchParams;
  const touch = { ts: now };
  for (const [param, field] of UTM_FIELDS) {
    const value = p.get(param);
    if (value) touch[field] = value.slice(0, 100);
  }
  if (p.get("gclid") || p.get("gbraid") || p.get("wbraid")) touch.clickId = "gclid";
  else if (p.get("ttclid")) touch.clickId = "ttclid";
  else if (p.get("fbclid")) touch.clickId = "fbclid";

  const ref = p.get("ref");
  if (ref && /^[A-Za-z0-9_-]{3,30}$/.test(ref) && !/^mystery-/i.test(ref)) touch.ref = ref.toUpperCase();

  let host = referrerHost(referrer);
  if (host && (OWN_HOST.test(host) || PAYMENT_HOST.test(host))) host = "";
  if (host) touch.referrer = host;

  const app = detectInAppBrowser(userAgent);
  if (app) touch.app = app;

  touch.landing = url.pathname.slice(0, 120);

  const isSignal = Boolean(
    touch.source || touch.medium || touch.campaign || touch.clickId || touch.ref || touch.referrer || touch.app
  );
  return { touch, isSignal };
}

function fresh(touch, now) {
  return touch && typeof touch.ts === "number" && now - touch.ts <= ATTRIBUTION_WINDOW_MS ? touch : null;
}

// Primer y último toque. Las visitas directas (sin ninguna señal) NO pisan
// el último toque de una campaña: "último toque no directo", el mismo
// criterio que usa Google Analytics. Si no había nada guardado, una visita
// directa sí queda registrada (para saber al menos cuándo/dónde aterrizó).
export function mergeTouches(stored, result, now) {
  let first = fresh(stored?.first, now);
  let last = fresh(stored?.last, now);
  if (!first && last) first = last;
  if (result) {
    if (result.isSignal) {
      last = result.touch;
      first = first || result.touch;
    } else if (!first && !last) {
      first = last = result.touch;
    }
  }
  return first || last ? { v: 1, first, last } : null;
}

// ---------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------

function readStore(now) {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    return raw ? mergeTouches(JSON.parse(raw), null, now) : null;
  } catch {
    return null;
  }
}

// Llamado una vez por carga de documento (OriginTracker). Nunca lanza.
export function recordLanding() {
  try {
    const now = Date.now();
    const result = buildTouch({
      href: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      now,
    });
    if (!result) return;
    const stored = readStore(now);
    const next = mergeTouches(stored, result, now);
    if (next && JSON.stringify(next) !== JSON.stringify(stored)) {
      window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // storage bloqueado (modo privado, navegador interno restringido): el
    // pedido queda como "Desconocido", la compra sigue igual.
  }
}

// Lo que viaja con el pedido. Síncrono, microsegundos. Nunca lanza.
export function readAttributionForOrder() {
  if (typeof window === "undefined") return null;
  const stored = readStore(Date.now());
  return stored ? { first: stored.first, last: stored.last } : null;
}

