"use client";

import { FRAME_TYPES, getPriceCOP, formatCOP } from "../lib/order";

// Selector visual "Selecciona tipo de cuadro": Premium (con marco trasero
// de 3cm) vs. Tradicional (más delgado, con soporte para colgar). Reutiliza
// el mismo patrón de tarjeta seleccionable que el selector de tamaño en
// CrearFlow.jsx (borde/glow morado al seleccionar).
//
// Siempre 2 columnas, incluso en móvil angosto (iPhone SE, 375px) — antes
// era 1 columna hasta el breakpoint "sm" (640px) y se apilaba
// verticalmente. Padding/tipografía más compactos por debajo de "sm" para
// que el nombre + descripción + precio quepan sin verse apretados en una
// columna de ~165px; desde "sm" vuelve al tamaño original.
export default function FrameTypeSelector({ frameType, onChange, minSizeId = "30x40" }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-[#33456b]">Selecciona tipo de cuadro</h2>
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        {Object.values(FRAME_TYPES).map((type) => {
          const isSelected = type.id === frameType;
          const fromPrice = getPriceCOP(minSizeId, type.id);
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => onChange(type.id)}
              className={`flex w-full flex-col items-start rounded-xl border px-2.5 py-2 text-left transition-colors sm:px-4 sm:py-3 ${
                isSelected
                  ? "border-accent bg-accent/15 shadow-[0_0_0_1px_rgba(168,85,247,0.6),0_0_20px_rgba(168,85,247,0.25)]"
                  : "border-black/10 bg-[#fffaf0] hover:border-black/20"
              }`}
            >
              <span className={`text-xs font-semibold sm:text-sm ${isSelected ? "text-[#1b2a4a]" : "text-[#1b2a4a]"}`}>
                {type.label}
              </span>
              <span className="mt-0.5 text-[10px] leading-snug text-[#5b6b8c] sm:text-xs">
                {type.description}
              </span>
              <span
                className={`mt-1.5 text-xs font-bold sm:text-sm ${
                  isSelected ? "text-accent" : "text-[#5b6b8c]"
                }`}
              >
                Desde {formatCOP(fromPrice)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
