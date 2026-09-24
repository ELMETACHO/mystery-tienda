"use client";

import { useEffect, useRef, useState } from "react";

// Texto del botón según el paso en que va el cliente dentro de CrearFlow
// (publicado por CrearFlow vía el evento "crearflow:state").
const LABELS = {
  upload: "Comprar ahora",
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
// - sin foto: scroll suave hasta el flujo embebido (para que suba la foto);
// - con foto: lo mismo que "Continuar" (arma el cuadro) y sube hasta el
//   flujo, donde aparece "Tu cuadro está listo";
// - cuadro listo: lo mismo que "Continuar con el envío" (va al checkout).
export default function StickyBuyButton({ targetId }) {
  const [isTargetVisible, setIsTargetVisible] = useState(false);
  const [crearState, setCrearState] = useState({ stage: "upload", isBusy: false });
  const observerRef = useRef(null);

  // Mientras la sección del flujo embebido (CrearFlow) esté visible en
  // pantalla, sin importar en qué paso esté el usuario, este botón se
  // oculta — sus propios botones ("Continuar", etc.) ya cumplen ese rol
  // ahí y ambos a la vez se estorban visualmente. No toca nada de
  // CrearFlow: solo observa el contenedor de la sección desde afuera.
  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setIsTargetVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(target);
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [targetId]);

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
        <button
          type="button"
          onClick={handleClick}
          disabled={crearState.isBusy}
          tabIndex={isTargetVisible ? -1 : 0}
          className="flex w-full items-center justify-center rounded-full bg-accent px-6 py-4 text-base font-bold text-white shadow-lg shadow-accent/30 active:bg-accent-soft disabled:opacity-70"
        >
          {label}
        </button>
        <p className="mt-1.5 text-center text-[11px] font-semibold text-[#33456b]">
          🚚 Envío gratis · 💵 Paga al recibir
        </p>
      </div>
    </div>
  );
}
