"use client";

import { useEffect, useRef, useState } from "react";
import { pushToDataLayer } from "../../lib/gtm";

// Texto del botón según el paso en que va el cliente dentro de CrearFlow
// (publicado por CrearFlow vía el evento "crearflow:state").
const LABELS = {
  upload: "📷 Subir mi foto",
  edit: "Continuar con mi cuadro",
  ready: "Continuar con el envío",
};

// Antes llevaba a /crear como página aparte; ahora el flujo vive embebido
// en esta misma página (ver app/ads/page.js). position: fixed (no sticky)
// anclado a inset-x-0 bottom-0 — sticky en un contenedor con overflow puede
// "despegarse" en Safari durante el scroll, fixed se comporta igual en
// Safari iOS y Chrome Android.
//
// Qué hace al tocarlo depende del paso:
// - sin foto (oct 2026): es un <label> del input de archivo de CrearFlow —
//   abre directo la galería del celular (antes solo bajaba hasta la caja
//   de carga y el cliente tenía que tocar otra vez). Cuando la foto carga,
//   app/ads/AdsFlowBridge.jsx lo baja hasta el editor;
// - con foto: lo mismo que "Continuar" (arma el cuadro) y sube hasta el
//   flujo, donde aparece "Tu cuadro está listo";
// - cuadro listo: lo mismo que "Continuar con el envío" (va al checkout).
const BUTTON_CLASS =
  "flex w-full cursor-pointer items-center justify-center rounded-full bg-accent px-6 py-4 text-base font-bold text-white shadow-lg shadow-accent/30 active:bg-accent-soft";

export default function StickyBuyButton({ targetId, alsoHideWhenVisibleIds = [] }) {
  // Arranca oculta: el IntersectionObserver confirma en el primer frame si
  // hay que mostrarla (evita el "parpadeo" de la barra encima del CTA del
  // primer pantallazo al cargar).
  const [isTargetVisible, setIsTargetVisible] = useState(true);
  const [crearState, setCrearState] = useState({ stage: "upload", isBusy: false });
  const observerRef = useRef(null);
  const hideIdsKey = alsoHideWhenVisibleIds.join(",");

  // Mientras la sección del flujo embebido (CrearFlow) esté visible en
  // pantalla, sin importar en qué paso esté el usuario, este botón se
  // oculta — sus propios botones ("Continuar", etc.) ya cumplen ese rol
  // ahí y ambos a la vez se estorban visualmente. No toca nada de
  // CrearFlow: solo observa el contenedor de la sección desde afuera.
  // alsoHideWhenVisibleIds (oct 2026): mismo criterio para el CTA del
  // primer pantallazo de /ads — dos botones morados iguales a la vez
  // confunden.
  useEffect(() => {
    const ids = [targetId, ...(hideIdsKey ? hideIdsKey.split(",") : [])];
    const targets = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (targets.length === 0) {
      // Sin nada que observar, la barra siempre visible.
      const raf = requestAnimationFrame(() => setIsTargetVisible(false));
      return () => cancelAnimationFrame(raf);
    }

    const visible = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        setIsTargetVisible(visible.size > 0);
      },
      { threshold: 0 }
    );
    targets.forEach((t) => observer.observe(t));
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [targetId, hideIdsKey]);

  useEffect(() => {
    const onState = (e) => setCrearState(e.detail);
    window.addEventListener("crearflow:state", onState);
    return () => window.removeEventListener("crearflow:state", onState);
  }, []);

  const scrollToTarget = () => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleClick = () => {
    if (crearState.isBusy) return;
    pushToDataLayer({ event: "ads_cta_click", cta_location: "sticky", cta_stage: crearState.stage });
    if (crearState.stage === "upload") {
      scrollToTarget();
      return;
    }
    // Con la foto ya subida, "Continuar" arma el cuadro y CrearFlow mismo
    // lleva al cliente hasta "Tu cuadro está listo" cuando aparece. En
    // "listo", navega directo al checkout.
    window.dispatchEvent(new CustomEvent("crearflow:primary-action"));
  };

  const label = crearState.isBusy ? "Preparando tu cuadro..." : LABELS[crearState.stage];

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white/90 px-4 pt-3 backdrop-blur-md transition-opacity duration-300 ${
        isTargetVisible ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      aria-hidden={isTargetVisible}
    >
      {/* pr-[4.5rem]: hueco a la derecha para el botón flotante del chat
          (ChatWidget lo alinea a esta barra en /ads) — sin esto, el chat
          tapaba el borde del botón de compra. */}
      <div className="pr-[4.5rem]">
        {crearState.stage === "upload" && !crearState.isBusy ? (
          <label
            htmlFor="file-upload"
            onClick={() => pushToDataLayer({ event: "ads_cta_click", cta_location: "sticky", cta_stage: "upload" })}
            tabIndex={isTargetVisible ? -1 : 0}
            className={BUTTON_CLASS}
          >
            {label}
          </label>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            disabled={crearState.isBusy}
            tabIndex={isTargetVisible ? -1 : 0}
            className={`${BUTTON_CLASS} disabled:opacity-70`}
          >
            {label}
          </button>
        )}
        <p className="mt-1.5 text-center text-[11px] font-semibold text-[#33456b]">
          🚚 Envío gratis · 💵 Paga al recibir
        </p>
      </div>
    </div>
  );
}
