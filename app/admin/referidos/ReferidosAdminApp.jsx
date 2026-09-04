"use client";

import { useEffect, useState } from "react";
import { formatCOP } from "../../lib/order";

export default function ReferidosAdminApp() {
  const [referrals, setReferrals] = useState(null);
  const [error, setError] = useState("");
  const [payingCode, setPayingCode] = useState(null);

  const loadReferrals = async () => {
    setError("");
    try {
      const res = await fetch("/api/referidos-admin-list");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar la lista");
      setReferrals(data.referrals);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la lista de referidos.");
    }
  };

  useEffect(() => {
    loadReferrals();
  }, []);

  const handleMarkPaid = async (code) => {
    setPayingCode(code);
    setError("");
    try {
      const res = await fetch("/api/referidos-admin-mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo marcar como pagado");
      // Quita al referido de la lista sin volver a pedir todo — su
      // saldo ya quedó en 0, así que ya no cumple el filtro de la API.
      setReferrals((prev) => prev.filter((r) => r.code !== code));
    } catch (err) {
      console.error(err);
      setError("No se pudo marcar como pagado. Intenta de nuevo.");
    } finally {
      setPayingCode(null);
    }
  };

  return (
    <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
            Comisiones pendientes de pago
          </h1>
          <p className="mt-1 text-sm text-[#33456b]">
            Referidos con saldo acumulado — márcalos como pagados cuando les transfieras.
          </p>
        </div>
        <a
          href="/admin"
          className="shrink-0 rounded-full border border-black/10 bg-[#fffaf0] px-4 py-2 text-xs font-medium text-[#33456b] transition-colors hover:border-accent/40 hover:text-accent"
        >
          ← Admin
        </a>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {referrals === null ? (
        <p className="text-sm text-[#5b6b8c]">Cargando...</p>
      ) : referrals.length === 0 ? (
        <p className="rounded-xl border border-black/10 bg-[#fffaf0] px-4 py-6 text-center text-sm text-[#5b6b8c]">
          No hay comisiones pendientes por pagar.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {referrals.map((r) => (
            <li
              key={r.code}
              className="flex items-center justify-between gap-4 rounded-2xl border border-black/10 bg-[#fffaf0] p-4"
            >
              <div className="flex flex-col">
                <span className="font-medium text-[#1b2a4a]">{r.name}</span>
                <span className="font-mono text-xs tracking-wider text-[#5b6b8c]">
                  {r.code}
                </span>
                <span className="mt-1 text-xs text-[#5b6b8c]">
                  {r.totalSales} venta{r.totalSales === 1 ? "" : "s"} en total
                </span>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-lg font-bold text-accent">
                  {formatCOP(r.totalCommission)}
                </span>
                <button
                  type="button"
                  onClick={() => handleMarkPaid(r.code)}
                  disabled={payingCode === r.code}
                  className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {payingCode === r.code ? "Marcando..." : "Marcar como pagado"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
