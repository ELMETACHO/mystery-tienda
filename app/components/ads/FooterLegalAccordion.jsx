"use client";

import { useState } from "react";
import { LEGAL_SECTIONS as ITEMS } from "@/app/lib/legalContent";

// Fila de 3 botones (no links, no navegan a otra página) que despliegan su
// texto debajo — un único área de contenido compartida, como acordeón:
// tocar el mismo botón lo cierra, tocar otro reemplaza el contenido.
export default function FooterLegalAccordion() {
  const [openKey, setOpenKey] = useState(null);
  const active = ITEMS.find((item) => item.key === openKey);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
        {ITEMS.map((item, i) => (
          <span key={item.key} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpenKey((prev) => (prev === item.key ? null : item.key))}
              aria-expanded={openKey === item.key}
              className={`underline-offset-2 transition-colors ${
                openKey === item.key ? "text-accent-soft underline" : "hover:text-zinc-300 hover:underline"
              }`}
            >
              {item.label}
            </button>
            {i < ITEMS.length - 1 && <span aria-hidden="true">·</span>}
          </span>
        ))}
      </div>

      {active && (
        <p className="mx-auto mt-3 max-w-md text-left text-[11px] leading-relaxed text-zinc-500">
          {active.text}
        </p>
      )}
    </div>
  );
}
