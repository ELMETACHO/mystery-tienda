"use client";

import { FRAME_TYPES, getPriceCOP, formatCOP } from "../lib/order";

// Selector visual "Selecciona tipo de cuadro": Premium (con marco trasero
// de 3cm) vs. Tradicional (más delgado, con soporte para colgar). Reutiliza
// el mismo patrón de tarjeta seleccionable que el selector de tamaño en
// CrearFlow.jsx (borde/glow morado al seleccionar).
export default function FrameTypeSelector({ frameType, onChange, minSizeId = "30x40" }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-zinc-300">Selecciona tipo de cuadro</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Object.values(FRAME_TYPES).map((type) => {
          const isSelected = type.id === frameType;
          const fromPrice = getPriceCOP(minSizeId, type.id);
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => onChange(type.id)}
              className={`flex w-full flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors ${
                isSelected
                  ? "border-accent bg-accent/15 shadow-[0_0_0_1px_rgba(168,85,247,0.6),0_0_20px_rgba(168,85,247,0.25)]"
                  : "border-white/10 bg-white/5 hover:border-white/20"
              }`}
            >
              <span className={`text-sm font-semibold ${isSelected ? "text-white" : "text-zinc-200"}`}>
                {type.label}
              </span>
              <span className="mt-0.5 text-xs text-zinc-400">{type.description}</span>
              <span className={`mt-1.5 text-sm font-bold ${isSelected ? "text-accent-soft" : "text-zinc-400"}`}>
                Desde {formatCOP(fromPrice)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
