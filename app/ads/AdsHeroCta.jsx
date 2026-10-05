"use client";

import useCrearStage from "./useCrearStage";
import { pushToDataLayer } from "../lib/gtm";

const LABEL_CLASS =
  "flex w-full cursor-pointer items-center justify-center rounded-full bg-accent px-6 py-4 text-base font-bold text-white shadow-lg shadow-accent/30 transition-colors active:bg-accent-soft";

// CTA principal del primer pantallazo. Sin foto todavía, es un <label> del
// MISMO <input id="file-upload"> que vive dentro de CrearFlow: un toque
// abre directo la galería del celular (patrón label+for, el que funciona
// en móvil — ver CLAUDE.md), sin tener que bajar primero hasta el flujo.
// AdsFlowBridge se encarga de bajar al editor cuando la foto ya cargó.
// Con la foto ya subida, el botón solo lleva de vuelta al flujo.
export default function AdsHeroCta({ label, targetId }) {
  const { stage } = useCrearStage();

  if (stage === "upload") {
    return (
      <label
        htmlFor="file-upload"
        className={LABEL_CLASS}
        onClick={() => pushToDataLayer({ event: "ads_cta_click", cta_location: "hero", cta_stage: stage })}
      >
        {label}
      </label>
    );
  }

  return (
    <button
      type="button"
      className={LABEL_CLASS}
      onClick={() => {
        pushToDataLayer({ event: "ads_cta_click", cta_location: "hero", cta_stage: stage });
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      {stage === "ready" ? "Ver mi cuadro y continuar" : "Seguir con mi cuadro"}
    </button>
  );
}
