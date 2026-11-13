import { channelLabel } from "../lib/attributionChannels";

// Colores por familia de canal — solo para reconocerlos de un vistazo.
const CHANNEL_STYLES = {
  google_organico: "bg-emerald-100 text-emerald-800",
  google_ads: "bg-emerald-200 text-emerald-900",
  instagram: "bg-pink-100 text-pink-800",
  instagram_ads: "bg-pink-200 text-pink-900",
  facebook: "bg-blue-100 text-blue-800",
  facebook_ads: "bg-blue-200 text-blue-900",
  tiktok_organico: "bg-slate-200 text-slate-800",
  tiktok_ads: "bg-slate-300 text-slate-900",
  whatsapp: "bg-green-100 text-green-800",
  referido: "bg-amber-100 text-amber-800",
  email: "bg-violet-100 text-violet-800",
  directo: "bg-sky-100 text-sky-800",
  otro: "bg-stone-200 text-stone-700",
};

const UNKNOWN_STYLE = "bg-stone-100 text-stone-500";

export function OrigenBadge({ attribution }) {
  const channel = attribution?.channel;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        CHANNEL_STYLES[channel] || UNKNOWN_STYLE
      }`}
      title="Origen del cliente"
    >
      {channelLabel(channel)}
    </span>
  );
}

function fmtDay(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

// Detalle en una o dos líneas: campaña, página de aterrizaje, desde dónde
// y, si fue distinto, el primer contacto. Nunca lanza con datos viejos.
export function OrigenDetails({ attribution }) {
  const last = attribution?.last;
  const first = attribution?.first;
  if (!last && !first) return null;
  const parts = [];
  if (last?.campaign) parts.push(`Campaña: ${last.campaign}`);
  if (last?.source && !last?.campaign) parts.push(`Fuente: ${last.source}${last.medium ? ` / ${last.medium}` : ""}`);
  if (last?.content) parts.push(`Anuncio: ${last.content}`);
  if (last?.term) parts.push(`Término: ${last.term}`);
  if (last?.referrer) parts.push(`Desde: ${last.referrer}`);
  if (last?.app && !last?.referrer) parts.push(`App: ${last.app}`);
  if (last?.ref) parts.push(`Código: ${last.ref}`);
  if (last?.landing) parts.push(`Llegó a: ${last.landing}`);
  if (last?.ts) parts.push(fmtDay(last.ts));
  const firstDiffers =
    first && last && (first.channel !== last.channel || first.campaign !== last.campaign || first.ts !== last.ts);
  return (
    <p className="text-xs text-[#5b6b8c]">
      {parts.join(" · ")}
      {firstDiffers && (
        <>
          <br />
          Primer contacto: {channelLabel(first.channel)}
          {first.campaign ? ` · ${first.campaign}` : ""}
          {first.landing ? ` · ${first.landing}` : ""}
          {first.ts ? ` · ${fmtDay(first.ts)}` : ""}
        </>
      )}
    </p>
  );
}

// Conteo de pedidos por canal (de mayor a menor) para el resumen.
export function OrigenSummary({ items }) {
  const counts = new Map();
  for (const a of items) {
    const key = a?.channel || "desconocido";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  // De mayor a menor; "Desconocido" (pedidos viejos o sin datos) al final.
  const rows = [...counts.entries()].sort(
    (x, y) => (x[0] === "desconocido") - (y[0] === "desconocido") || y[1] - x[1]
  );
  if (rows.length === 0) return null;
  return (
    <div className="rounded-2xl border border-black/10 bg-[#fffaf0] p-4">
      <p className="text-sm font-semibold text-[#1b2a4a]">Origen de los pedidos</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {rows.map(([channel, n]) => (
          <span key={channel} className="inline-flex items-center gap-1.5">
            <OrigenBadge attribution={channel === "desconocido" ? null : { channel }} />
            <span className="text-sm font-semibold text-[#33456b]">{n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
