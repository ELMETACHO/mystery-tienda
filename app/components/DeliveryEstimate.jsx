"use client";

import { useSyncExternalStore } from "react";
import { formatDeliveryRange, getDeliveryEstimate } from "../lib/deliveryEstimate";

// "Llega entre el … y el …" calculado en el navegador con la fecha de HOY
// en Bogotá (app/lib/deliveryEstimate.js). Se calcula en el cliente y no en
// el servidor porque /producto y otras páginas se cachean (ISR): una fecha
// renderizada en el servidor quedaría vieja. En el HTML del servidor sale
// el texto genérico de siempre (mismo alto), así no hay salto de diseño ni
// error de hidratación. Solo texto: no toca el pedido ni el pago.
const FALLBACK = "Hecho en 1-2 días · llega en máximo 5 días (sin domingos)";

function subscribe() {
  // La fecha solo cambia a medianoche; no hace falta re-suscribirse.
  return () => {};
}

function getSnapshot() {
  try {
    return formatDeliveryRange(getDeliveryEstimate());
  } catch {
    return FALLBACK;
  }
}

function getServerSnapshot() {
  return FALLBACK;
}

export default function DeliveryEstimate({ className = "", variant = "default" }) {
  const text = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isEstimate = text !== FALLBACK;

  if (variant === "compact") {
    return (
      <p className={`flex items-center justify-center gap-1.5 text-center text-xs text-[#33456b] ${className}`}>
        <span aria-hidden="true">🚚</span>
        <span>
          {text}
          {isEstimate && <span className="text-[#5b6b8c]"> · envío gratis</span>}
        </span>
      </p>
    );
  }

  return (
    <div
      className={`flex flex-col items-center gap-0.5 rounded-xl border border-black/10 bg-[#fffaf0] px-3 py-2 text-center ${className}`}
    >
      <p className="flex items-center gap-1.5 text-sm font-semibold text-[#1b2a4a]">
        <span aria-hidden="true">🚚</span>
        {text}
      </p>
      <p className="text-[11px] text-[#5b6b8c]">
        {isEstimate
          ? "Si pides hoy · 1-2 días de producción + envío (sin domingos ni festivos)"
          : "Envío gratis a toda Colombia"}
      </p>
    </div>
  );
}
