"use client";

import { useEffect, useState } from "react";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CrmApp() {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setError("");
      try {
        const res = await fetch("/api/crm-list");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "No se pudo cargar el CRM");
        setEntries(json.entries);
      } catch (err) {
        console.error(err);
        setError("No se pudo cargar el CRM.");
      }
    })();
  }, []);

  return (
    <div className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">CRM</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Datos de contacto y compra de cada pedido confirmado.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a
            href="/admin"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-accent/40 hover:text-accent-soft"
          >
            ← Admin
          </a>
          <a
            href="/admin/finanzas"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-accent/40 hover:text-accent-soft"
          >
            Finanzas →
          </a>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {entries !== null && entries.length > 0 && (
        <div className="rounded-2xl border border-accent/30 bg-accent/10 p-5 shadow-[0_0_40px_-14px_rgba(168,85,247,0.3)]">
          <p className="text-sm text-zinc-400">Total de contactos</p>
          <p className="text-2xl font-bold text-accent-soft sm:text-3xl">{entries.length}</p>
        </div>
      )}

      {entries === null ? (
        <p className="text-sm text-zinc-500">Cargando...</p>
      ) : entries.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-zinc-500">
          Todavía no hay entradas en el CRM.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-accent/30 bg-accent/5 shadow-[0_0_40px_-14px_rgba(168,85,247,0.3)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-accent/20 bg-accent/10 text-xs uppercase tracking-wide text-accent-soft">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Dirección</th>
                <th className="px-4 py-3 font-medium">Correo</th>
                <th className="px-4 py-3 font-medium">Tamaño</th>
                <th className="px-4 py-3 font-medium">Método de pago</th>
                <th className="px-4 py-3 font-medium">Cupón/Referido</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Compras</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr
                  key={i}
                  className="border-b border-white/5 transition-colors last:border-0 hover:bg-accent/5"
                >
                  <td className="px-4 py-3 font-medium text-zinc-100">{e.nombre}</td>
                  <td className="px-4 py-3 text-zinc-300">{e.telefono || "-"}</td>
                  <td className="px-4 py-3 text-zinc-300">{e.direccion || "-"}</td>
                  <td className="px-4 py-3 text-zinc-300">{e.correo}</td>
                  <td className="px-4 py-3 text-zinc-300">{e.sizeLabel}</td>
                  <td className="px-4 py-3 text-zinc-300">{e.metodoPago}</td>
                  <td className="px-4 py-3 text-zinc-300">{e.cuponOReferido || "-"}</td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(e.fecha)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent-soft">
                      {e.totalHistorico}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
