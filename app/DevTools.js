"use client";

import { useEffect } from "react";

// TEMPORAL: panel de consola visible en pantalla para depurar en celulares
// sin acceso a Safari Web Inspector (no hace falta Mac). Solo se activa en
// desarrollo. RECORDATORIO: quitar este componente (y su import en
// app/layout.js) antes de publicar a producción.
export default function DevTools() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    import("eruda").then((eruda) => {
      eruda.default.init();
      console.log("[DevTools] Eruda inicializado — toca el botón flotante para abrir la consola");
    });
  }, []);

  return null;
}
