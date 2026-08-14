"use client";

import { useEffect, useState } from "react";
import { formatCOP } from "../lib/order";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminApp() {
  const [data, setData] = useState(null); // { balance, orders }
  const [error, setError] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  const load = async () => {
    setError("");
    try {
      const res = await fetch("/api/admin-list");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo cargar la lista");
      setData(json);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar el saldo del fabricante.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleMarkPaid = async () => {
    if (!confirm("¿Confirmas que ya le pagaste TODO el saldo pendiente al fabricante?")) return;

    setIsPaying(true);
    setError("");
    try {
      const res = await fetch("/api/admin-mark-paid", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo marcar como pagado");
      setData({ balance: 0, orders: [] });
    } catch (err) {
      console.error(err);
      setError("No se pudo marcar como pagado. Intenta de nuevo.");
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Saldo pendiente al fabricante
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Pedidos confirmados que todavía no se le han pagado al fabricante.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {data === null ? (
        <p className="text-sm text-zinc-500">Cargando...</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-accent/30 bg-accent/10 p-5 shadow-[0_0_40px_-14px_rgba(168,85,247,0.3)]">
            <div>
              <p className="text-sm text-zinc-400">Total adeudado</p>
              <p className="text-2xl font-bold text-accent-soft sm:text-3xl">
                {formatCOP(data.balance)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleMarkPaid}
              disabled={isPaying || data.balance === 0}
              className="shrink-0 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPaying ? "Marcando..." : "✅ Ya pagué todo"}
            </button>
          </div>

          {data.orders.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-zinc-500">
              No hay saldo pendiente con el fabricante.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.orders.map((o) => (
                <li
                  key={o.reference}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-zinc-100">{o.cliente}</span>
                    <span className="text-xs text-zinc-500">{o.ciudad}</span>
                    <span className="mt-1 text-xs text-zinc-500">{formatDate(o.fecha)}</span>
                    {o.guideUrl && (
                      <a
                        href={o.guideUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 text-xs text-accent-soft underline underline-offset-2"
                      >
                        Ver guía
                      </a>
                    )}
                  </div>
                  <span className="text-lg font-bold text-accent-soft">
                    {formatCOP(o.monto)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
