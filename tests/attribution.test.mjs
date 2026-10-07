import { test } from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTION_WINDOW_MS, buildTouch, detectInAppBrowser, mergeTouches } from "../app/lib/attribution.js";
import {
  attributionSummary,
  channelLabel,
  classifyTouch,
  sanitizeAttribution,
  withSanitizedAttribution,
} from "../app/lib/attributionChannels.js";

const NOW = Date.UTC(2026, 9, 7, 16, 0, 0);
const SITE = "https://www.mysterycuadros.com";
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1";
const IG_UA = SAFARI + " Instagram 350.0.0.0 (iPhone15,2; iOS 18_0; es_CO)";
const FB_UA = SAFARI + " [FBAN/FBIOS;FBAV/480.0.0]";
const TT_UA = SAFARI + " musical_ly_35.0 BytedanceWebview/d8a21c6";

function land(path, referrer = "", userAgent = SAFARI) {
  return buildTouch({ href: SITE + path, referrer, userAgent, now: NOW });
}
const ch = (path, referrer, ua) => classifyTouch(land(path, referrer, ua)?.touch);

test("clasificador: UTM y click ids", () => {
  assert.equal(ch("/crear?utm_source=instagram&utm_medium=social"), "instagram");
  assert.equal(ch("/crear?utm_source=ig&utm_medium=paid&utm_campaign=navidad"), "instagram_ads");
  assert.equal(ch("/ads?utm_source=facebook&utm_medium=cpc&fbclid=abc"), "facebook_ads");
  assert.equal(ch("/ads?utm_source=meta&utm_medium=paid", "https://l.instagram.com/"), "instagram_ads");
  assert.equal(ch("/ads?utm_source=tiktok&utm_medium=paid&ttclid=x"), "tiktok_ads");
  assert.equal(ch("/ads?ttclid=x"), "tiktok_ads");
  assert.equal(ch("/?utm_source=tiktok&utm_medium=bio"), "tiktok_organico");
  assert.equal(ch("/?gclid=Cj0KCQ"), "google_ads");
  assert.equal(ch("/?gbraid=0AAAA"), "google_ads");
  assert.equal(ch("/?utm_source=google&utm_medium=cpc"), "google_ads");
  assert.equal(ch("/?utm_source=google&utm_medium=organic"), "google_organico");
  assert.equal(ch("/?utm_source=whatsapp"), "whatsapp");
  assert.equal(ch("/?utm_source=newsletter&utm_medium=email"), "email");
  assert.equal(ch("/?utm_medium=email"), "email");
  assert.equal(ch("/?utm_source=revista-x"), "otro");
  assert.equal(ch("/crear?ref=JUAN23"), "referido");
});

test("clasificador: referrer y navegador interno de la app", () => {
  assert.equal(ch("/categoria/musica", "https://www.google.com/"), "google_organico");
  assert.equal(ch("/", "https://www.google.com.co/"), "google_organico");
  assert.equal(ch("/", "android-app://com.google.android.googlequicksearchbox/"), "google_organico");
  assert.equal(ch("/", "https://www.googleadservices.com/"), "google_ads");
  assert.equal(ch("/", "https://mail.google.com/"), "email");
  assert.equal(ch("/", "android-app://com.google.android.gm/"), "email");
  assert.equal(ch("/", "https://l.instagram.com/"), "instagram");
  assert.equal(ch("/", "https://lm.facebook.com/"), "facebook");
  assert.equal(ch("/", "https://www.tiktok.com/"), "tiktok_organico");
  assert.equal(ch("/", "https://web.whatsapp.com/"), "whatsapp");
  assert.equal(ch("/", "https://www.bing.com/"), "otro");
  assert.equal(ch("/", "", IG_UA), "instagram");
  assert.equal(ch("/", "", FB_UA), "facebook");
  assert.equal(ch("/", "", TT_UA), "tiktok_organico");
  assert.equal(ch("/?fbclid=abc", "", IG_UA), "instagram");
  assert.equal(ch("/?fbclid=abc"), "facebook");
  assert.equal(ch("/"), "directo");
  assert.equal(classifyTouch(null), "directo");
});

test("buildTouch: sin datos personales, referrer interno/pasarela no cuenta, rutas excluidas", () => {
  const { touch, isSignal } = land("/crear?utm_source=instagram&utm_campaign=oct&email=a@b.com&gclid=SECRET", "https://l.instagram.com/x?u=1");
  assert.ok(isSignal);
  assert.equal(touch.landing, "/crear");
  assert.equal(touch.referrer, "l.instagram.com");
  assert.equal(touch.clickId, "gclid"); // solo presencia, nunca el valor
  assert.ok(!JSON.stringify(touch).includes("SECRET"));
  assert.ok(!JSON.stringify(touch).includes("a@b.com"));

  assert.equal(land("/crear", "https://www.mysterycuadros.com/").isSignal, false);
  assert.equal(land("/crear", "https://checkout.wompi.co/").isSignal, false);
  assert.equal(land("/checkout/confirmacion?id=123", "https://checkout.wompi.co/"), null);
  assert.equal(land("/pedido?ref=mystery-1789530352469"), null);
  assert.equal(land("/resena?ref=mystery-1&token=x"), null);
  assert.equal(land("/admin"), null);
  assert.equal(land("/?ref=mystery-1789530352469").touch.ref, undefined);
  assert.equal(buildTouch({ href: "no es url", now: NOW }), null);
});

test("detectInAppBrowser", () => {
  assert.equal(detectInAppBrowser(IG_UA), "instagram");
  assert.equal(detectInAppBrowser(FB_UA), "facebook");
  assert.equal(detectInAppBrowser(TT_UA), "tiktok");
  assert.equal(detectInAppBrowser(SAFARI), "");
  assert.equal(detectInAppBrowser(undefined), "");
});

test("primer y último toque: 30 días, lo directo no pisa una campaña", () => {
  const ig = land("/crear?utm_source=instagram&utm_campaign=oct");
  let s = mergeTouches(null, ig, NOW);
  assert.equal(classifyTouch(s.first), "instagram");
  assert.equal(classifyTouch(s.last), "instagram");

  // Vuelve directo: se conserva Instagram como último toque.
  s = mergeTouches(s, land("/"), NOW + 1000);
  assert.equal(classifyTouch(s.last), "instagram");

  // Vuelve desde Google: cambia el último, el primero se queda.
  const g = buildTouch({ href: SITE + "/categoria/musica", referrer: "https://www.google.com/", now: NOW + 2000 });
  s = mergeTouches(s, g, NOW + 2000);
  assert.equal(classifyTouch(s.first), "instagram");
  assert.equal(classifyTouch(s.last), "google_organico");

  // Pasados 30 días, todo vence y una visita directa empieza de cero.
  const later = NOW + ATTRIBUTION_WINDOW_MS + 5000;
  const d = buildTouch({ href: SITE + "/", referrer: "", now: later });
  s = mergeTouches(s, d, later);
  assert.equal(classifyTouch(s.first), "directo");
  assert.equal(classifyTouch(s.last), "directo");

  // Primera visita directa sí queda registrada.
  assert.equal(classifyTouch(mergeTouches(null, land("/"), NOW).last), "directo");
  assert.equal(mergeTouches(null, null, NOW), null);
  assert.equal(mergeTouches({ first: "x", last: 5 }, null, NOW), null);
});

test("sanitizeAttribution: lista blanca, largos, canal recalculado en el servidor", () => {
  const dirty = {
    first: { channel: "google_ads", source: "instagram", ts: NOW, landing: "/crear?token=abc", evil: "x" },
    last: {
      channel: "google_ads", // mentira del navegador: se recalcula
      source: "instagram",
      medium: "paid",
      campaign: "<script>alert(1)</script>" + "x".repeat(500),
      content: "juan@correo.com",
      clickId: "otro-id",
      referrer: "bad host/<>",
      app: "snapchat",
      landing: "javascript:alert(1)",
      ts: 99999999999999,
      __proto__: { polluted: true },
    },
  };
  const a = sanitizeAttribution(dirty, { now: NOW });
  assert.equal(a.channel, "instagram_ads");
  assert.equal(a.last.channel, "instagram_ads");
  assert.ok(a.last.campaign.length <= 100);
  assert.ok(!a.last.campaign.includes("<"));
  assert.equal(a.last.content, "[correo]");
  assert.equal(a.last.clickId, undefined);
  assert.equal(a.last.referrer, undefined);
  assert.equal(a.last.app, undefined);
  assert.equal(a.last.landing, undefined);
  assert.equal(a.last.ts, undefined);
  assert.equal(a.first.landing, "/crear");
  assert.equal(a.first.evil, undefined);
  assert.equal(a.first.channel, "instagram");
  // Idempotente: limpiar dos veces da lo mismo (webhook + confirm-order).
  assert.deepEqual(sanitizeAttribution(a, { now: NOW }), a);
});

test("sanitizeAttribution: datos faltantes o rotos nunca lanzan", () => {
  assert.equal(sanitizeAttribution(undefined), null);
  assert.equal(sanitizeAttribution(null), null);
  assert.equal(sanitizeAttribution("basura"), null);
  assert.equal(sanitizeAttribution([1, 2]), null);
  assert.equal(sanitizeAttribution({ first: 5, last: "x" }), null);
  // Código de referido digitado en el checkout y visita directa/sin datos.
  assert.equal(sanitizeAttribution(null, { referralCode: "JUAN23" }).channel, "referido");
  const direct = sanitizeAttribution({ last: { landing: "/", ts: NOW } }, { referralCode: "JUAN23", now: NOW });
  assert.equal(direct.channel, "referido");
  const ig = sanitizeAttribution({ last: { source: "instagram", ts: NOW } }, { referralCode: "JUAN23", now: NOW });
  assert.equal(ig.channel, "instagram");
});

test("withSanitizedAttribution y etiquetas", () => {
  const order = { sizeId: "40x50", priceCOP: 89000, attribution: { last: { source: "tiktok", medium: "paid", campaign: "oct" } } };
  const out = withSanitizedAttribution(order);
  assert.equal(out.attribution.channel, "tiktok_ads");
  assert.equal(out.priceCOP, 89000);
  assert.notEqual(out, order);
  assert.equal(withSanitizedAttribution({ sizeId: "30x40" }).attribution, null);
  assert.equal(withSanitizedAttribution(null), null);
  assert.equal(channelLabel(undefined), "Desconocido");
  assert.equal(channelLabel("google_organico"), "Google orgánico");
  assert.equal(attributionSummary(out.attribution), "TikTok Ads · oct");
  assert.equal(attributionSummary(null), "Desconocido");
});
