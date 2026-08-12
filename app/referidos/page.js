"use client";

import { useState } from "react";
import Link from "next/link";

const INPUT_CLASS =
  "rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-base outline-none transition-colors duration-200 focus:border-accent focus:ring-1 focus:ring-accent/30 sm:py-3 sm:text-sm";

const BENEFITS = [
  "Sin inversión, sin letra pequeña",
  "Ve tus ventas en tiempo real",
  "Retira cuando quieras, directo por WhatsApp",
];

export default function ReferidosPage() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { code, name }

  const isFormValid = name.trim() && whatsapp.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/create-referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, whatsapp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo generar el código");
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("No pudimos generar tu código. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-24">
        {result ? (
          <div className="flex w-full flex-col items-center gap-5 animate-ready-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-3xl text-accent-soft">
              🎉
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              ¡Listo, {result.name}!
            </h1>
            <p className="text-zinc-400">Este es tu código de embajador Mystery:</p>

            <div className="w-full rounded-2xl border border-dashed border-accent/50 bg-accent/5 px-6 py-5">
              <span className="font-mono text-2xl font-bold tracking-widest text-accent-soft sm:text-3xl">
                {result.code}
              </span>
            </div>

            <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-5 text-left text-sm text-zinc-300">
              <p className="mb-2 font-medium text-zinc-100">¿Cómo funciona?</p>
              <ol className="flex flex-col gap-2 text-zinc-400">
                <li>1. Comparte tu código con quien quieras.</li>
                <li>
                  2. Cuando compren un cuadro Mystery, deben escribir tu código en el
                  campo de código del checkout.
                </li>
                <li>3. Ganas comisión por esa venta — automático, sin que hagas nada más.</li>
                <li>
                  4. Revisa tus ventas y tu comisión acumulada en tu panel cuando
                  quieras.
                </li>
              </ol>
            </div>

            <Link
              href="/referidos/panel"
              className="w-full rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/50 transition-colors hover:bg-accent-soft"
            >
              Ir a mi panel de referido
            </Link>
            <p className="text-xs text-zinc-500">
              Guarda tu código — lo vas a necesitar para entrar a tu panel.
            </p>
          </div>
        ) : (
          <>
            <span className="text-3xl">💜</span>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
              Gana dinero recomendando Mystery
            </h1>
            <p className="text-lg font-medium text-zinc-200">
              ¿Ya amas tus cuadros? Compártelos y gana por cada venta.
            </p>
            <p className="text-sm text-zinc-400 sm:text-base">
              Únete al equipo de embajadores Mystery — te damos tu propio código, lo
              compartes con quien quieras, y cada vez que alguien compre usándolo, tú
              te llevas tu comisión. Así de simple.
            </p>

            <ul className="flex flex-col gap-2 text-sm text-zinc-300">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-center gap-2">
                  <span className="text-emerald-400">✅</span>
                  {benefit}
                </li>
              ))}
            </ul>

            {!showForm ? (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-2 w-full max-w-xs rounded-full bg-gradient-to-r from-fuchsia-500 via-accent to-purple-700 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/50 transition-all duration-200 hover:shadow-[0_0_36px_rgba(168,85,247,0.85)]"
              >
                Quiero mi código
              </button>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="mt-2 flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-left"
              >
                <input
                  type="text"
                  placeholder="Tu nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={INPUT_CLASS}
                />
                <input
                  type="tel"
                  placeholder="Tu WhatsApp (con indicativo, ej. 3001234567)"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className={INPUT_CLASS}
                />
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className="rounded-full bg-gradient-to-r from-fuchsia-500 via-accent to-purple-700 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/50 transition-all duration-200 hover:shadow-[0_0_36px_rgba(168,85,247,0.85)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  {isSubmitting ? "Generando..." : "Generar mi código"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
