"use client";

import { useState } from "react";
import { formatCOP, SIZES } from "../../lib/order";

// Número de WhatsApp del negocio ("CUADROS MYSTERY") — mismo que se usa
// como contacto de origen para las guías de Skydropx (ver ORIGIN.phone
// en app/lib/skydropx.js), con indicativo de Colombia para el link wa.me.
const WHATSAPP_NUMBER = "573202646716";

const INPUT_CLASS =
  "rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-base outline-none transition-colors duration-200 focus:border-accent focus:ring-1 focus:ring-accent/30 sm:py-3 sm:text-sm";

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

export default function ReferidosPanelPage() {
  const [codeInput, setCodeInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [referral, setReferral] = useState(null);

  const handleLookup = async (e) => {
    e.preventDefault();
    const code = codeInput.trim().toUpperCase();
    if (!code) return;

    setIsLoading(true);
    setError("");
    setReferral(null);
    try {
      const res = await fetch(`/api/referral-status?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Código no encontrado");
        return;
      }
      setReferral(data);
    } catch (err) {
      console.error(err);
      setError("No pudimos consultar tu código. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const whatsappHref = referral
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        `Hola, quiero retirar mi saldo de referido. Mi código es: ${referral.code}. Saldo acumulado: ${formatCOP(
          referral.totalCommission
        )}`
      )}`
    : "";

  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-6 px-4 py-16 sm:px-6 sm:py-24">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Tu panel de referido
          </h1>
          <p className="text-sm text-zinc-400">
            Ingresa tu código para ver tus ventas y tu comisión acumulada.
          </p>
        </div>

        <form onSubmit={handleLookup} className="flex w-full gap-2">
          <input
            type="text"
            placeholder="Tu código de referido"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            className={`flex-1 ${INPUT_CLASS} text-center font-mono tracking-widest uppercase`}
          />
          <button
            type="submit"
            disabled={isLoading || !codeInput.trim()}
            className="shrink-0 rounded-xl bg-gradient-to-r from-fuchsia-500 via-accent to-purple-700 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/50 transition-all duration-200 hover:shadow-[0_0_36px_rgba(168,85,247,0.85)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:py-3"
          >
            {isLoading ? "Buscando..." : "Ver mi panel"}
          </button>
        </form>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {referral && (
          <div className="flex w-full flex-col gap-4 animate-ready-in">
            <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_40px_-14px_rgba(168,85,247,0.3)] sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Embajador</p>
                  <p className="text-lg font-semibold text-white">{referral.name}</p>
                </div>
                <span className="rounded-full bg-accent/15 px-3 py-1 font-mono text-xs font-medium tracking-wider text-accent-soft">
                  {referral.code}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                  <p className="text-xs text-zinc-400">Ventas totales</p>
                  <p className="text-xl font-bold text-white">{referral.totalSales}</p>
                </div>
                <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-center">
                  <p className="text-xs text-zinc-400">Comisión acumulada</p>
                  <p className="text-xl font-bold text-accent-soft">
                    {formatCOP(referral.totalCommission)}
                  </p>
                </div>
              </div>

              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-gradient-to-r from-fuchsia-500 via-accent to-purple-700 px-6 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-accent/50 transition-all duration-200 hover:shadow-[0_0_36px_rgba(168,85,247,0.85)]"
              >
                💸 Retirar saldo
              </a>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
              <h2 className="mb-4 text-sm font-medium text-zinc-300">Tus últimas ventas</h2>
              {referral.orders.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Todavía no tienes ventas registradas — comparte tu código para empezar
                  a ganar.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {[...referral.orders]
                    .reverse()
                    .map((order, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                      >
                        <div className="flex flex-col">
                          <span className="text-zinc-200">{sizeLabel(order.sizeId)}</span>
                          <span className="text-xs text-zinc-500">
                            {formatDate(order.date)}
                          </span>
                        </div>
                        <span className="font-semibold text-emerald-400">
                          +{formatCOP(order.commission)}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
