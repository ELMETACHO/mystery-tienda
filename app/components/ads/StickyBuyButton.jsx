"use client";

import { useEffect, useRef, useState } from "react";

// Antes llevaba a /crear como página aparte; ahora el flujo vive embebido
// en esta misma página (ver app/ads/page.js), así que el botón hace scroll
// suave hasta esa sección en vez de navegar. position: fixed (no sticky)
// anclado a inset-x-0 bottom-0 — sticky en un contenedor con overflow puede
// "despegarse" en Safari durante el scroll, fixed se comporta igual en
// Safari iOS y Chrome Android.
export default function StickyBuyButton({ targetId }) {
  const [isTargetVisible, setIsTargetVisible] = useState(false);
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

  const handleClick = () => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-background/95 px-4 pt-3 backdrop-blur-md transition-opacity duration-300 ${
        isTargetVisible ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      aria-hidden={isTargetVisible}
    >
      <button
        type="button"
        onClick={handleClick}
        tabIndex={isTargetVisible ? -1 : 0}
        className="flex w-full items-center justify-center rounded-full bg-accent px-6 py-4 text-base font-bold text-white shadow-lg shadow-accent/30 active:bg-accent-soft"
      >
        Comprar ahora
      </button>
    </div>
  );
}
