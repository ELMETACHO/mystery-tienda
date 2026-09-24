import { COD_DEPOSIT_COP } from "../../lib/order";

const depositLabel = `$${COD_DEPOSIT_COP.toLocaleString("es-CO")}`;

// Reemplaza la cuenta regresiva y el contador de "personas viendo" (ambos
// simulados, ver ADS.md ronda 3): en vez de urgencia inventada, repite la
// oferta REAL que más vende — 75% de los pedidos son contraentrega. El
// anticipo va siempre visible en letra chica: "Paga al recibir" sin
// aclararlo sería otra promesa engañosa (el cliente sí paga
// COD_DEPOSIT_COP por Wompi antes del envío).
//
// variant="card": bloque grande de dos columnas, para arriba de la página.
// variant="pill": una sola línea compacta, para repetir cerca de cada CTA.
export default function OfferBadges({ variant = "card" }) {
  if (variant === "pill") {
    return (
      <p className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold text-[#1b2a4a]">
        <span>🚚 Envío gratis</span>
        <span aria-hidden="true" className="text-[#8a94ac]">·</span>
        <span>💵 Paga al recibir</span>
      </p>
    );
  }

  return (
    <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
      <div className="rounded-xl border border-emerald-600/25 bg-emerald-50 px-3 py-2.5 text-center">
        <p className="text-sm font-bold text-emerald-800">🚚 Envío gratis</p>
        <p className="mt-0.5 text-[11px] leading-snug text-emerald-900/80">
          Hasta tu casa, en 3-5 días hábiles
        </p>
      </div>
      <div className="rounded-xl border border-emerald-600/25 bg-emerald-50 px-3 py-2.5 text-center">
        <p className="text-sm font-bold text-emerald-800">💵 Paga al recibir</p>
        <p className="mt-0.5 text-[11px] leading-snug text-emerald-900/80">
          Separas con {depositLabel} y el resto en la puerta
        </p>
      </div>
    </div>
  );
}
