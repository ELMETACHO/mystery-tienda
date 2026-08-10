"use client";

import { useState } from "react";
import { SIZES, formatCOP } from "../../lib/order";
import ProductBuyButton from "./ProductBuyButton";
import FreeShippingBanner from "../../components/FreeShippingBanner";

// Mismo patrón de selección que /crear (app/crear/page.js): tarjetas por
// tamaño, precio que se actualiza según SIZES, no un valor fijo del
// producto — ahora el catálogo vende los 3 tamaños, elegidos acá.
export default function ProductSizeSelector({ product }) {
  const [sizeId, setSizeId] = useState("40x50");
  const size = SIZES.find((s) => s.id === sizeId);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-3xl font-bold text-accent-soft">{formatCOP(size.priceCOP)}</p>
      <FreeShippingBanner />

      <div className="flex flex-col gap-2">
        {SIZES.map((s) => {
          const isSelected = s.id === sizeId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSizeId(s.id)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                isSelected
                  ? "border-accent bg-accent/15 shadow-[0_0_0_1px_rgba(168,85,247,0.6),0_0_20px_rgba(168,85,247,0.25)]"
                  : "border-white/10 bg-white/5 hover:border-white/20"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`text-sm ${isSelected ? "text-white" : "text-zinc-300"}`}>{s.label}</span>
                {s.id === "40x50" && (
                  <span className="whitespace-nowrap rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-soft">
                    Más elegido
                  </span>
                )}
              </span>
              <span className={`text-sm font-bold ${isSelected ? "text-accent-soft" : "text-zinc-400"}`}>
                {formatCOP(s.priceCOP)}
              </span>
            </button>
          );
        })}
      </div>

      <ProductBuyButton product={product} sizeId={size.id} sizeLabel={size.label} priceCOP={size.priceCOP} />
    </div>
  );
}
