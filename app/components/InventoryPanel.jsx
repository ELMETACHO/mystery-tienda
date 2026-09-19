"use client";

import { useCallback, useEffect, useState } from "react";

function fmt(iso) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Panel de inventario compartido por /admin/inventario (Oscar) y
// /fabricante (Cristhian). `code` (opcional) se envía a la API del
// fabricante; sin él se usa la sesión de admin.
export default function InventoryPanel({ code }) {
  const endpoint = code ? "/api/fabricante-inventory" : "/api/admin-inventory";
  const [items, setItems] = useState(null);
  const [log, setLog] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const apply = (json) => {
    setItems(json.items);
    setLog(json.log || []);
  };

  const load = useCallback(async () => {
    try {
      const url = code ? `${endpoint}?code=${encodeURIComponent(code)}` : endpoint;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setItems(json.items);
      setLog(json.log || []);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar el inventario.");
    }
  }, [code, endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (field, body) => {
    setBusy(field);
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, code, ...body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      apply(json);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al guardar");
    } finally {
      setBusy("");
    }
  };

  const askNumber = (msg) => {
    const v = window.prompt(msg);
    if (v == null || v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const low = (items || []).filter((i) => i.low);

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-sm text-[#33456b]">
        Se descuenta solo con cada venta real. Los Tradicionales también gastan 1 soporte dentado.
      </p>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {low.length > 0 && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">⚠️ Toca pedir más a los proveedores:</p>
          <ul className="mt-1 list-disc pl-5">
            {low.map((i) => (
              <li key={i.field}>
                {i.label}: {i.quantity <= 0 ? "agotado" : `quedan ${i.quantity}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!items ? (
        <p className="text-sm text-[#33456b]">Cargando…</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((i) => (
            <li
              key={i.field}
              className={`flex flex-col gap-3 rounded-2xl border p-4 ${
                i.low ? "border-red-300 bg-red-50" : "border-black/10 bg-[#fffaf0]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[#1b2a4a]">{i.label}</p>
                  <p className="text-xs text-[#5b6b8c]">Alerta cuando queden {i.threshold} o menos</p>
                </div>
                <span className={`text-3xl font-bold ${i.low ? "text-red-600" : "text-[#1b2a4a]"}`}>
                  {i.quantity}
                </span>
              </div>
              <p className="text-xs text-[#5b6b8c]">
                {i.lastUpdate
                  ? `Última actualización: ${fmt(i.lastUpdate.at)} · ${i.lastUpdate.by} — ${i.lastUpdate.note}`
                  : "Sin actualizaciones todavía (stock inicial)"}
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  disabled={busy === i.field}
                  onClick={() => {
                    const n = askNumber("¿Cuántas unidades llegaron?");
                    if (n != null) send(i.field, { add: n });
                  }}
                  className="rounded-lg border border-black/10 px-3 py-1.5 font-medium"
                >
                  + Reponer
                </button>
                <button
                  disabled={busy === i.field}
                  onClick={() => {
                    const n = askNumber("Cantidad exacta en stock:");
                    if (n != null) send(i.field, { set: n });
                  }}
                  className="rounded-lg border border-black/10 px-3 py-1.5 font-medium"
                >
                  Corregir cantidad
                </button>
                <button
                  disabled={busy === i.field}
                  onClick={() => {
                    const n = askNumber("Avisar cuando queden (o menos):");
                    if (n != null) send(i.field, { threshold: n });
                  }}
                  className="rounded-lg border border-black/10 px-3 py-1.5 font-medium"
                >
                  Cambiar umbral
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {log.length > 0 && (
        <div className="rounded-2xl border border-black/10 bg-[#fffaf0] p-4">
          <p className="mb-2 text-sm font-semibold text-[#1b2a4a]">Últimos movimientos</p>
          <ul className="flex flex-col gap-1.5 text-xs text-[#33456b]">
            {log.map((l, idx) => (
              <li key={idx}>
                {fmt(l.at)} · <strong>{l.by}</strong> · {l.label}: {l.note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
