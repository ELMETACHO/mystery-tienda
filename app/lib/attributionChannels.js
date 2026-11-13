// Canales, etiquetas y limpieza server-side del origen de un pedido (ver
// attribution.js para la captura en el navegador). Lo usan los caminos de
// confirmación (servidor) y /admin — nunca la tienda del cliente.
import { UTM_FIELDS } from "./attribution";

export const CHANNEL_LABELS = {
  google_organico: "Google orgánico",
  google_ads: "Google Ads",
  instagram: "Instagram",
  instagram_ads: "Instagram Ads",
  facebook: "Facebook",
  facebook_ads: "Facebook Ads",
  tiktok_organico: "TikTok orgánico",
  tiktok_ads: "TikTok Ads",
  whatsapp: "WhatsApp",
  referido: "Referido",
  email: "Email",
  directo: "Directo",
  otro: "Otro",
};

export function channelLabel(channel) {
  return CHANNEL_LABELS[channel] || "Desconocido";
}

const PAID_MEDIUM = /^(cpc|ppc|cpm|cpv|paid|paid[_ -]?social|paidsocial|ads?|display|sponsored|pago|anuncio)$/;

function lower(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hostIs(host, pattern) {
  return pattern.test(host);
}

// Clasifica un toque en un canal legible. Recibe solo los campos ya
// capturados/limpios (source, medium, clickId, referrer, ref, app).
export function classifyTouch(touch) {
  if (!touch || typeof touch !== "object") return "directo";
  const src = lower(touch.source);
  const med = lower(touch.medium);
  const ref = lower(touch.referrer);
  const app = lower(touch.app);
  const clickId = lower(touch.clickId);
  const paid = PAID_MEDIUM.test(med) || med.includes("paid");
  const igHint =
    app === "instagram" || hostIs(ref, /(^|\.)instagram\.com$/) || ref === "com.instagram.android";

  if (touch.ref) return "referido";
  if (clickId === "gclid") return "google_ads";
  if (clickId === "ttclid") return "tiktok_ads";

  if (src) {
    if (/google|adwords|gads/.test(src)) return paid ? "google_ads" : "google_organico";
    if (/tiktok|^tt$/.test(src)) return paid ? "tiktok_ads" : "tiktok_organico";
    if (/instagram|^ig$/.test(src)) return paid ? "instagram_ads" : "instagram";
    if (/facebook|^fb$|^meta$|messenger/.test(src)) {
      if (src === "meta" && igHint) return paid ? "instagram_ads" : "instagram";
      return paid ? "facebook_ads" : "facebook";
    }
    if (/whatsapp|^wa$/.test(src)) return "whatsapp";
    if (/mail|newsletter|resend|klaviyo/.test(src) || med === "email") return "email";
    if (/referid|referral|embajador/.test(src)) return "referido";
    return "otro";
  }
  if (med === "email") return "email";

  // fbclid lo pegan Facebook e Instagram a TODO enlace saliente (anuncio u
  // orgánico): sin utm no se puede saber si fue pagado.
  if (clickId === "fbclid") return igHint ? "instagram" : "facebook";

  if (ref) {
    if (hostIs(ref, /(^|\.)(googleadservices\.com|doubleclick\.net|googlesyndication\.com)$/)) return "google_ads";
    if (
      hostIs(ref, /^(mail\.google\.com|com\.google\.android\.gm)$|(^|\.)(outlook\.(live|office|office365)\.com|mail\.yahoo\.com)$/)
    )
      return "email";
    if (hostIs(ref, /(^|\.)google\.[a-z.]{2,7}$/) || ref === "com.google.android.googlequicksearchbox")
      return "google_organico";
    if (igHint) return "instagram";
    if (hostIs(ref, /(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/) || ref === "com.facebook.katana")
      return "facebook";
    if (hostIs(ref, /(^|\.)(tiktok\.com)$/) || ref === "com.zhiliaoapp.musically") return "tiktok_organico";
    if (hostIs(ref, /(^|\.)(whatsapp\.com|wa\.me)$/) || ref === "com.whatsapp") return "whatsapp";
    return "otro";
  }

  if (app === "instagram") return "instagram";
  if (app === "facebook") return "facebook";
  if (app === "tiktok") return "tiktok_organico";
  return "directo";
}

const EMAIL_LIKE = /[^\s@]+@[^\s@]+/g;

function cleanText(value, max) {
  if (typeof value !== "string") return undefined;
  const out = value
    .replace(EMAIL_LIKE, "[correo]")
    .replace(/[\u0000-\u001f\u007f<>"'`\\]/g, "")
    .trim()
    .slice(0, max);
  return out || undefined;
}

const MIN_TS = Date.UTC(2025, 0, 1);

function sanitizeTouch(raw, now) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const touch = {};
  for (const [, field] of UTM_FIELDS) {
    const v = cleanText(raw[field], 100);
    if (v) touch[field] = v;
  }
  if (["gclid", "ttclid", "fbclid"].includes(raw.clickId)) touch.clickId = raw.clickId;
  if (typeof raw.ref === "string" && /^[A-Za-z0-9_-]{3,30}$/.test(raw.ref)) touch.ref = raw.ref.toUpperCase();
  if (typeof raw.referrer === "string" && /^[a-z0-9.-]{1,100}$/i.test(raw.referrer)) {
    touch.referrer = raw.referrer.toLowerCase();
  }
  if (["instagram", "facebook", "tiktok"].includes(raw.app)) touch.app = raw.app;
  if (typeof raw.landing === "string" && raw.landing.startsWith("/")) {
    const path = cleanText(raw.landing.split(/[?#]/)[0], 120);
    if (path) touch.landing = path;
  }
  const ts = Number(raw.ts);
  if (Number.isFinite(ts) && ts >= MIN_TS && ts <= now + 24 * 60 * 60 * 1000) touch.ts = Math.round(ts);
  touch.channel = classifyTouch(touch);
  return touch;
}

// Limpia la atribución que mandó el navegador. Nunca lanza: si viene rota
// o manipulada, devuelve lo rescatable o null.
export function sanitizeAttribution(raw, { referralCode, now = Date.now() } = {}) {
  try {
    const first = raw && typeof raw === "object" ? sanitizeTouch(raw.first, now) : null;
    const last = raw && typeof raw === "object" ? sanitizeTouch(raw.last, now) || first : null;
    let channel = last?.channel || null;
    // Código de referido digitado en el checkout: si la visita no traía
    // otra pista (directa o sin datos), el canal real es el referido.
    if (referralCode && (!channel || channel === "directo")) channel = "referido";
    if (!channel) return null;
    return { v: 1, channel, first: first || last, last };
  } catch {
    return null;
  }
}

// Devuelve el pedido con su atribución limpia (o null). Puro y síncrono —
// microsegundos, seguro en cualquier camino de confirmación.
export function withSanitizedAttribution(order) {
  if (!order || typeof order !== "object") return order;
  try {
    return {
      ...order,
      attribution: sanitizeAttribution(order.attribution, { referralCode: order.referralCode }),
    };
  } catch {
    return { ...order, attribution: null };
  }
}

// Texto corto para el admin/CRM: "Instagram · campaña navidad".
export function attributionSummary(attribution) {
  const label = channelLabel(attribution?.channel);
  const campaign = attribution?.last?.campaign;
  return campaign ? `${label} · ${campaign}` : label;
}
