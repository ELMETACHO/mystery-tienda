"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { formatCOP, SIZES } from "../../lib/order";

function sizeLabel(sizeId) {
  return SIZES.find((s) => s.id === sizeId)?.label || sizeId;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Vista de solo lectura para el fabricante, protegida con un código
// simple (FABRICANTE_ACCESS_CODE, ver app/api/fabricante-status/route.js)
// en vez de ADMIN_PASSWORD — mismo patrón que /referidos/panel. Sin CRM
// ni botón de marcar como pagado.
function FabricanteContent() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code");

  const [codeInput, setCodeInput] = useState(codeFromUrl || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const lookupCode = useCallback(async (rawCode) => {
    const code = rawCode.trim();
    if (!code) return;

    setIsLoading(true);
    setError("");
    setData(null);
    try {
      const res = await fetch(`/api/fabricante-status?code=${encodeURIComponent(code)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Código incorrecto");
        return;
      }
      setData(json);
    } catch (err) {
      console.error(err);
      setError("No pudimos consultar tu saldo. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (codeFromUrl) {
      lookupCode(codeFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromUrl]);

  const handleLookup = (e) => {
    e.preventDefault();
    lookupCode(codeInput);
  };

  return (
    <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-6 px-4 py-16 sm:px-6 sm:py-24">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tu saldo pendiente</h1>
        <p className="text-sm text-zinc-400">Ingresa tu código de acceso para consultarlo.</p>
      </div>

      <form onSubmit={handleLookup} className="flex w-full gap-2">
        <input
          type="text"
          placeholder="Código de acceso"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-base outline-none transition-colors duration-200 focus:border-accent focus:ring-1 focus:ring-accent/30 sm:py-3 sm:text-sm"
        />
        <button
          type="submit"
          disabled={isLoading || !codeInput.trim()}
          className="shrink-0 rounded-xl bg-gradient-to-r from-fuchsia-500 via-accent to-purple-700 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/50 transition-all duration-200 hover:shadow-[0_0_36px_rgba(168,85,247,0.85)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:py-3"
        >
          {isLoading ? "Consultando..." : "Ver saldo"}
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {data && (
        <div className="flex w-full flex-col gap-4 animate-ready-in">
          <div className="rounded-2xl border border-accent/30 bg-accent/10 p-5 text-center shadow-[0_0_40px_-14px_rgba(168,85,247,0.3)] sm:p-6">
            <p className="text-sm text-zinc-400">Total pendiente</p>
            <p className="text-2xl font-bold text-accent-soft sm:text-3xl">
              {formatCOP(data.balance)}
            </p>
          </div>

          {data.balance === 0 && data.lastPayment && (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-300">
              ✅ Recibiste tu último pago: {formatCOP(data.lastPayment.amount)} el{" "}
              {formatDate(data.lastPayment.date)}
            </p>
          )}

          {data.orders.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-zinc-500">
              No hay saldo pendiente.
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
                    <span className="text-xs text-zinc-500">{sizeLabel(o.sizeId)}</span>
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
                  <span className="text-lg font-bold text-accent-soft">{formatCOP(o.monto)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function FabricantePage() {
  return (
    <Suspense fallback={null}>
      <FabricanteContent />
    </Suspense>
  );
}
