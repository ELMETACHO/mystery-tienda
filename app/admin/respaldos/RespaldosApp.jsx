"use client";

import { useEffect, useState } from "react";
import { formatCOP } from "../../lib/order";

function fmt(iso) {
  return new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function addressLines(c = {}) {
  const home =
    c.housingType === "apartamento"
      ? [c.buildingName, c.tower && `Torre ${c.tower}`, c.apartmentNumber && `Apto ${c.apartmentNumber}`].filter(Boolean).join(", ")
      : "";
  return [c.street, home, c.additionalInstructions, `${c.neighborhood || ""} — ${c.city || ""}, ${c.department || ""}`]
    .filter(Boolean)
    .join("\n");
}

export default function RespaldosApp() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin-backups");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setRows(json.backups);
      } catch (err) {
        console.error(err);
        setError("No se pudieron cargar los respaldos.");
      }
    })();
  }, []);

  const copy = async (ref, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(ref);
      setTimeout(() => setCopied(""), 1500);
    } catch {}
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6">
      <div>
        <a href="/admin" className="text-sm text-accent underline underline-offset-2">← Admin</a>
        <h1 className="mt-2 font-heading text-xl font-bold tracking-tight sm:text-2xl">Respaldos de pedidos pagados</h1>
        <p className="mt-1 text-sm text-[#33456b]">
          Copia de cada pedido pagado (datos de entrega + imagen de impresión), guardada 1 año.
        </p>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!rows && !error && <p className="text-sm text-[#33456b]">Cargando…</p>}
      {rows && rows.length === 0 && <p className="text-sm text-[#33456b]">Todavía no hay respaldos.</p>}

      <ul className="flex flex-col gap-3">
        {(rows || []).map((r) => (
          <li key={r.reference} className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-[#fffaf0] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[#1b2a4a]">{r.customer?.fullName}</p>
                <p className="text-xs text-[#5b6b8c]">
                  {r.customer?.email} · {r.customer?.phonePrefix} {r.customer?.phone}
                </p>
              </div>
              <p className="text-right text-xs text-[#5b6b8c]">{fmt(r.savedAt)}</p>
            </div>
            <p className="text-sm text-[#33456b]">
              {r.sizeLabel} · {r.frameType === "tradicional" ? "Tradicional" : "Premium"} · {formatCOP(r.priceCOP || 0)} ·{" "}
              {r.paymentMethod === "cod" ? "Contraentrega (anticipo)" : r.paymentMethod === "regalo" ? "Regalo" : "Pago completo"}
              {r.isCatalog ? " · Catálogo" : ""}
            </p>
            <pre className="whitespace-pre-wrap rounded-lg bg-white/60 p-2 text-xs text-[#33456b]">{addressLines(r.customer)}</pre>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                onClick={() => copy(r.reference, `${r.customer?.fullName}\n${r.customer?.phonePrefix} ${r.customer?.phone}\n${addressLines(r.customer)}`)}
                className="rounded-lg border border-black/10 px-3 py-1.5 font-medium"
              >
                {copied === r.reference ? "✅ Copiado" : "Copiar datos de entrega"}
              </button>
              {r.hasImage ? (
                <a
                  href={`/api/admin-backup-image?ref=${encodeURIComponent(r.reference)}`}
                  className="rounded-lg border border-black/10 px-3 py-1.5 font-medium"
                >
                  ⬇ Descargar imagen de impresión
                </a>
              ) : (
                <span className="text-[#5b6b8c]">{r.isCatalog ? "Imagen en Drive (catálogo)" : "Sin imagen"}</span>
              )}
              <span className="text-[#8a94ac]">{r.reference}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
