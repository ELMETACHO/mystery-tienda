"use client";

import { useEffect, useState } from "react";

// Paso actual del flujo embebido (CrearFlow publica "crearflow:state" en
// cada cambio: upload | edit | ready). Mismo puente que ya usa
// StickyBuyButton — sin tocar CrearFlow.
export default function useCrearStage() {
  const [state, setState] = useState({ stage: "upload", isBusy: false });
  useEffect(() => {
    const onState = (e) => setState(e.detail);
    window.addEventListener("crearflow:state", onState);
    return () => window.removeEventListener("crearflow:state", onState);
  }, []);
  return state;
}
