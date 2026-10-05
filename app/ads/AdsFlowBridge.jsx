"use client";

import { useEffect, useRef } from "react";
import { pushToDataLayer } from "../lib/gtm";

const ATTRIBUTION_KEY = "mystery:ads-atribucion";
const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_id",
  "utm_term",
  "utm_content",
  "ttclid",
  "fbclid",
  "gclid",
  "temporada",
];

// Lee/guarda en localStorage sin romper nada si el navegador lo bloquea
// (modo privado, navegador interno de TikTok/Instagram con storage
// restringido, etc.).
function readStored() {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > ATTRIBUTION_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(value) {
  try {
    window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(value));
  } catch {
    // sin storage: la atribución igual viaja en el dataLayer de esta visita
  }
}

// Componente invisible de /ads con dos trabajos:
//
// 1. Atribución (UTM / click IDs): al aterrizar, toma utm_* / ttclid /
//    fbclid / gclid de la URL del anuncio, los guarda 30 días en
//    localStorage (primer y último toque) y los empuja al dataLayer como
//    evento "ads_landing". El dataLayer sobrevive a la navegación interna
//    de Next (/ads → /checkout es navegación del lado del cliente), así que
//    GTM puede leerlos como variables en begin_checkout/purchase. El píxel
//    de TikTok además guarda ttclid en su propia cookie — esto no lo
//    reemplaza, es un respaldo legible para GA4/Google Ads/Meta.
//
// 2. Puente con CrearFlow: cuando el cliente sube la foto desde un botón
//    que está FUERA del flujo (CTA del primer pantallazo o barra fija), lo
//    baja hasta el editor; y empuja "ads_photo_uploaded" una vez por visita
//    (señal intermedia entre ViewContent y AddToCart, útil para medir el
//    embudo y, si hace falta, como evento de optimización en TikTok).
export default function AdsFlowBridge({ targetId, temporada }) {
  const prevStageRef = useRef("upload");
  const photoTrackedRef = useRef(false);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const current = {};
      for (const key of PARAMS) {
        const value = url.searchParams.get(key);
        if (value) current[key] = value.slice(0, 200);
      }
      const stored = readStored();
      const hasNew = Object.keys(current).length > 0;
      const first = stored?.first || (hasNew ? current : null);
      const last = hasNew ? current : stored?.last || null;
      if (hasNew) writeStored({ ts: Date.now(), first, last });

      pushToDataLayer({
        event: "ads_landing",
        ads_temporada: temporada,
        ads_attribution: {
          ...(last || {}),
          first_utm_source: first?.utm_source || "",
          first_utm_campaign: first?.utm_campaign || "",
          landing_referrer: document.referrer ? new URL(document.referrer).hostname : "",
        },
      });
    } catch (err) {
      console.error("[ads] No se pudo leer la atribución:", err);
    }
  }, [temporada]);

  useEffect(() => {
    const onState = (e) => {
      const { stage } = e.detail || {};
      const prev = prevStageRef.current;
      prevStageRef.current = stage;
      if (prev !== "upload" || stage !== "edit") return;

      if (!photoTrackedRef.current) {
        photoTrackedRef.current = true;
        pushToDataLayer({ event: "ads_photo_uploaded", ads_temporada: temporada });
      }

      // Solo si el flujo no está a la vista (la foto se subió desde el CTA
      // de arriba o desde la barra fija). Si se subió desde la caja de
      // carga del propio flujo, no se mueve nada.
      const target = document.getElementById(targetId);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const outOfView = rect.top > window.innerHeight * 0.5 || rect.bottom < 0;
      if (outOfView) {
        // Un frame después: deja que CrearFlow pinte el editor primero,
        // para que el alto de la página ya sea el definitivo.
        requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    };
    window.addEventListener("crearflow:state", onState);
    return () => window.removeEventListener("crearflow:state", onState);
  }, [targetId, temporada]);

  return null;
}
