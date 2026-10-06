"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// "Así se ve en tu pared": el diseño del cliente sobre una pared de sala a
// ESCALA REAL, con un sofá (210 cm) y una persona (1,70 m) de referencia.
// Escena dibujada con CSS/SVG (sin fotos pesadas): todas las medidas salen
// de centímetros reales, así la proporción entre el cuadro, el sofá y la
// persona es exacta para cada tamaño de SIZES (app/lib/order.js).
//
// Este archivo NO se carga con la página: WallVisualizerButton lo importa
// con next/dynamic solo cuando el cliente toca "Ver en mi pared".

// Escena: pared de 320 cm de ancho × 270 cm de alto + franja de piso.
const SCENE_W_CM = 320;
const WALL_H_CM = 270;
const FLOOR_H_CM = 22;
const SCENE_H_CM = WALL_H_CM + FLOOR_H_CM;

const SOFA = { widthCm: 210, heightCm: 85, centerXcm: 195 };
const PERSON = { heightCm: 170, widthCm: 50, leftCm: 16 };

// Altura de colgado estándar: centro del cuadro a ~150 cm del piso, pero
// siempre al menos 20 cm por encima del espaldar del sofá.
const HANG_CENTER_CM = 150;
const GAP_OVER_SOFA_CM = 20;

const WALLS = [
  { id: "blanco", label: "Blanca", color: "#f3f1ec" },
  { id: "beige", label: "Beige", color: "#e8dcc8" },
  { id: "gris", label: "Gris", color: "#c9ccd1" },
  { id: "verde", label: "Verde", color: "#b9c7b4" },
];

function sizeCm(sizeId) {
  const [w, h] = String(sizeId).split("x").map(Number);
  return { w, h };
}

const pctX = (cm) => `${(cm / SCENE_W_CM) * 100}%`;
const pctY = (cm) => `${(cm / SCENE_H_CM) * 100}%`;

// Coloca la imagen como "cover" dentro del marco. `crop` (opcional) indica
// qué parte de la imagen es el diseño (los mockups del catálogo traen el
// diseño en el centro de una foto decorada, ver EstudioApp.jsx).
function DesignImage({ src, crop, imageRatio, frameRatio }) {
  // Caja interior con la proporción real del diseño, escalada para cubrir
  // el marco y centrada (recorta lo que sobre, como object-fit: cover).
  const coverByHeight = imageRatio > frameRatio;
  const inner = coverByHeight
    ? { height: "100%", width: `${(imageRatio / frameRatio) * 100}%`, left: `${(-(imageRatio / frameRatio - 1) / 2) * 100}%`, top: 0 }
    : { width: "100%", height: `${(frameRatio / imageRatio) * 100}%`, top: `${(-(frameRatio / imageRatio - 1) / 2) * 100}%`, left: 0 };

  return (
    <div className="absolute overflow-hidden" style={{ position: "absolute", ...inner }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- dataURL local o miniatura ya cacheada; next/image no aplica */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="absolute max-w-none select-none"
        style={
          crop
            ? { width: `${100 / crop.width}%`, left: `${(-crop.left / crop.width) * 100}%`, top: `${(-crop.top / crop.height) * 100}%`, height: `${100 / crop.height}%` }
            : { width: "100%", height: "100%", left: 0, top: 0, objectFit: "cover" }
        }
      />
    </div>
  );
}

function Sofa() {
  // viewBox en centímetros: 210 × 85.
  return (
    <svg viewBox="0 0 210 85" className="h-full w-full" aria-hidden="true">
      <rect x="0" y="22" width="22" height="55" rx="8" fill="#4b4f58" />
      <rect x="188" y="22" width="22" height="55" rx="8" fill="#4b4f58" />
      <rect x="14" y="4" width="182" height="50" rx="10" fill="#5a5f69" />
      <rect x="18" y="44" width="174" height="30" rx="7" fill="#636975" />
      <line x1="105" y1="46" x2="105" y2="72" stroke="#555a64" strokeWidth="1.5" />
      <rect x="10" y="77" width="5" height="8" fill="#2f2a26" />
      <rect x="195" y="77" width="5" height="8" fill="#2f2a26" />
      <rect x="30" y="30" width="34" height="22" rx="6" fill="#b08968" opacity="0.9" />
    </svg>
  );
}

function Person() {
  // Silueta de 1,70 m (mismo dibujo que la escala de /crear).
  return (
    <svg viewBox="0 0 14 32" preserveAspectRatio="none" className="h-full w-full" fill="#2b3550" opacity="0.55" aria-hidden="true">
      <circle cx="7" cy="2.6" r="2.4" />
      <path d="M7 5.6c-3.4 0-5.6 1.8-5.6 4.6v9.6c0 .9.7 1.3 1.4 1.3s1.3-.4 1.3-1.3V11h.6v19.6c0 .8.7 1.4 1.5 1.4s1.4-.6 1.4-1.4V20h.8v10.6c0 .8.7 1.4 1.4 1.4.8 0 1.5-.6 1.5-1.4V11h.6v8.8c0 .9.6 1.3 1.3 1.3s1.4-.4 1.4-1.3v-9.6c0-2.8-2.2-4.6-5.6-4.6Z" />
    </svg>
  );
}

export default function WallVisualizer({ imageSrc, crop = null, imageRatio, sizes, initialSizeId, selectedSizeId, onClose }) {
  const [sizeId, setSizeId] = useState(initialSizeId || sizes[0]?.id);
  const [wall, setWall] = useState(WALLS[0]);
  const [showPerson, setShowPerson] = useState(true);
  const closeRef = useRef(null);

  // Escape cierra; se bloquea el scroll de fondo mientras está abierto.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const { w, h } = sizeCm(sizeId);
  const frameRatio = w / h;
  const centerY = Math.max(HANG_CENTER_CM, SOFA.heightCm + GAP_OVER_SOFA_CM + h / 2);
  const frameBottomCm = FLOOR_H_CM + centerY - h / 2;
  const frameLeftCm = SOFA.centerXcm - w / 2;
  const sizeLabel = sizes.find((s) => s.id === sizeId)?.label || `${w} x ${h} cm`;

  // Portal a <body>: las páginas envuelven su contenido en contenedores
  // "relative z-10" que atraparían el modal debajo del botón del chat.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Así se ve en tu pared"
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="flex max-h-[100dvh] w-full max-w-2xl flex-col gap-3 overflow-y-auto rounded-t-3xl bg-[#fffaf0] p-4 text-left text-[#1b2a4a] shadow-2xl pb-8 sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-bold">Así se ve en tu pared</h2>
            <p className="text-xs text-[#5b6b8c]">Escala real: sofá de 2,10 m{showPerson ? " y persona de 1,70 m" : ""}.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-black/10 px-3 py-1.5 text-sm text-[#33456b] hover:border-accent"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Escena */}
        <div
          className="relative w-full overflow-hidden rounded-2xl border border-black/10"
          style={{ aspectRatio: `${SCENE_W_CM} / ${SCENE_H_CM}`, backgroundColor: wall.color }}
        >
          {/* luz suave de pared */}
          <div aria-hidden="true" className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 55% 25%, rgba(255,255,255,0.45), transparent 65%)" }} />
          {/* piso + guardaescoba */}
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0" style={{ height: pctY(FLOOR_H_CM), background: "linear-gradient(#a98563, #8a6a4c)" }} />
          <div aria-hidden="true" className="absolute inset-x-0" style={{ bottom: pctY(FLOOR_H_CM), height: pctY(8), background: "#ffffffcc" }} />

          {/* sofá */}
          <div
            className="absolute"
            style={{ left: pctX(SOFA.centerXcm - SOFA.widthCm / 2), width: pctX(SOFA.widthCm), bottom: pctY(FLOOR_H_CM - 2), height: pctY(SOFA.heightCm) }}
          >
            <Sofa />
          </div>

          {/* persona */}
          {showPerson && (
            <div
              className="absolute"
              style={{ left: pctX(PERSON.leftCm), width: pctX(PERSON.widthCm), bottom: pctY(FLOOR_H_CM - 1), height: pctY(PERSON.heightCm) }}
            >
              <Person />
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-[#2b3550]/70">1,70 m</span>
            </div>
          )}

          {/* cuadro */}
          <div
            className="absolute transition-all duration-300 ease-out"
            style={{
              left: pctX(frameLeftCm),
              width: pctX(w),
              bottom: pctY(frameBottomCm),
              height: pctY(h),
              boxShadow: "4px 8px 14px rgba(0,0,0,0.35)",
              outline: "1px solid rgba(0,0,0,0.35)",
            }}
          >
            <div className="absolute inset-0 overflow-hidden">
              <DesignImage src={imageSrc} crop={crop} imageRatio={imageRatio} frameRatio={frameRatio} />
            </div>
          </div>
          <span
            className="absolute -translate-x-1/2 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold text-[#1b2a4a] shadow-sm transition-all duration-300"
            style={{ left: pctX(SOFA.centerXcm), bottom: `calc(${pctY(frameBottomCm + h)} + 4px)` }}
          >
            {w} × {h} cm
          </span>
        </div>

        {/* Tamaños */}
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tamaño">
          {sizes.map((s) => {
            const active = s.id === sizeId;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSizeId(s.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? "border-accent bg-accent text-white" : "border-black/10 bg-white text-[#33456b] hover:border-accent"
                }`}
              >
                {s.label}
                {s.id === selectedSizeId && <span className={active ? "text-white/80" : "text-accent"}> · tu elección</span>}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[#33456b]">
          <span>Pared:</span>
          {WALLS.map((wl) => (
            <button
              key={wl.id}
              type="button"
              onClick={() => setWall(wl)}
              aria-label={`Pared ${wl.label}`}
              aria-pressed={wall.id === wl.id}
              className={`h-6 w-6 rounded-full border ${wall.id === wl.id ? "border-accent ring-2 ring-accent/40" : "border-black/15"}`}
              style={{ backgroundColor: wl.color }}
            />
          ))}
          <label className="ml-auto flex items-center gap-1.5">
            <input type="checkbox" checked={showPerson} onChange={(e) => setShowPerson(e.target.checked)} />
            Mostrar persona
          </label>
        </div>

        <p className="text-[11px] text-[#5b6b8c]">
          {sizeLabel}: vista aproximada a escala sobre un sofá estándar. El encuadre exacto de cada tamaño lo ves
          {selectedSizeId ? " y ajustas en el editor" : " al elegir el tamaño"}. Esta vista no cambia tu pedido.
        </p>
      </div>
    </div>,
    document.body
  );
}
