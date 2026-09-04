"use client";

import { useState } from "react";
import Link from "next/link";

const INPUT_CLASS =
  "rounded-xl border border-black/10 bg-[#fffaf0] px-4 py-3.5 text-base outline-none transition-colors duration-200 focus:border-accent focus:ring-1 focus:ring-accent/30 sm:py-3 sm:text-sm";

const BENEFITS = [
  "Sin inversión, sin letra pequeña",
  "Ve tus ventas en tiempo real",
  "Retira cuando quieras, directo por WhatsApp",
];

export default function ReferidosPage() {
  const [showForm, setShowForm] = useState(false);
  const [showLookup, setShowLookup] = useState(false);
  const [lookupCode, setLookupCode] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { code, name }
  const [linkCopied, setLinkCopied] = useState(false);

  const isFormValid = name.trim() && whatsapp.trim();
  const panelUrl =
    typeof window !== "undefined" ? `${window.location.origin}/referidos/panel` : "/referidos/panel";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(panelUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

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
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[#8fcaf0] text-[#1b2a4a]">
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/walls/fondo-cielo-2.webp)" }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-24">
        {result ? (
          <div className="flex w-full flex-col items-center gap-5 animate-ready-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-3xl text-accent">
              🎉
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              ¡Listo, {result.name}!
            </h1>
            <p className="text-[#33456b]">Este es tu código de embajador Mystery:</p>

            <div className="w-full rounded-2xl border border-dashed border-accent/50 bg-accent/5 px-6 py-5">
              <span className="font-mono text-2xl font-bold tracking-widest text-accent sm:text-3xl">
                {result.code}
              </span>
            </div>

            <p className="text-sm text-[#33456b]">
              Tus clientes recibirán <span className="font-semibold text-accent">5% de descuento</span>{" "}
              en su compra. Comparte tu código — por cada cuadro que se venda con él, tú
              ganas entre <span className="font-semibold text-[#1b2a4a]">$7.000</span> y{" "}
              <span className="font-semibold text-[#1b2a4a]">$13.000</span>, según el tamaño
              que elija tu cliente.
            </p>

            <div className="w-full rounded-2xl border border-black/10 bg-[#fffaf0] p-5 text-left text-sm text-[#33456b]">
              <p className="mb-2 font-medium text-[#1b2a4a]">¿Cómo funciona?</p>
              <ol className="flex flex-col gap-2 text-[#33456b]">
                <li>1. Comparte tu código con quien quieras.</li>
                <li>
                  2. Cuando compren un cuadro Mystery, deben escribir tu código en el
                  campo de código del checkout — tu cliente recibe 5% de descuento al
                  instante.
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

            <div className="w-full rounded-2xl border border-black/10 bg-[#fffaf0] p-4 text-left text-sm">
              <p className="text-[#33456b]">
                📌 Guarda este enlace para volver a ver tus ventas y comisión cuando
                quieras:
              </p>
              <p className="mt-1 break-all font-mono text-xs text-accent">
                {panelUrl}
              </p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="mt-3 w-full rounded-full border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/20"
              >
                {linkCopied ? "¡Copiado!" : "Copiar enlace"}
              </button>
            </div>

            <p className="text-xs text-[#5b6b8c]">
              Guarda tu código — lo vas a necesitar para entrar a tu panel.
            </p>
          </div>
        ) : (
          <>
            <span className="text-3xl">💜</span>
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
              Gana dinero recomendando Mystery
            </h1>
            <p className="text-lg font-medium text-[#1b2a4a]">
              ¿Ya amas tus cuadros? Compártelos y gana por cada venta.
            </p>
            <p className="text-sm text-[#33456b] sm:text-base">
              Únete al equipo de embajadores Mystery — te damos tu propio código, lo
              compartes con quien quieras, y cada vez que alguien compre usándolo, tú
              te llevas tu comisión. Así de simple.
            </p>

            <ul className="flex flex-col gap-2 text-sm text-[#33456b]">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-center gap-2">
                  <span className="text-emerald-600">✅</span>
                  {benefit}
                </li>
              ))}
            </ul>

            {!showForm && !showLookup ? (
              <div className="mt-2 flex w-full max-w-xs flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="w-full rounded-full bg-gradient-to-r from-fuchsia-500 via-accent to-purple-700 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/50 transition-all duration-200 hover:shadow-[0_0_36px_rgba(168,85,247,0.85)]"
                >
                  Quiero mi código
                </button>
                <button
                  type="button"
                  onClick={() => setShowLookup(true)}
                  className="text-sm font-medium text-[#33456b] underline underline-offset-4 transition-colors hover:text-accent"
                >
                  Ya tengo código
                </button>
              </div>
            ) : showForm ? (
              <form
                onSubmit={handleSubmit}
                className="mt-2 flex w-full flex-col gap-3 rounded-2xl border border-black/10 bg-[#fffaf0] p-5 text-left"
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
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className="rounded-full bg-gradient-to-r from-fuchsia-500 via-accent to-purple-700 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/50 transition-all duration-200 hover:shadow-[0_0_36px_rgba(168,85,247,0.85)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  {isSubmitting ? "Generando..." : "Generar mi código"}
                </button>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const code = lookupCode.trim();
                  if (!code) return;
                  window.location.href = `/referidos/panel?code=${encodeURIComponent(code)}`;
                }}
                className="mt-2 flex w-full flex-col gap-3 rounded-2xl border border-black/10 bg-[#fffaf0] p-5 text-left"
              >
                <input
                  type="text"
                  placeholder="Tu código de referido"
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value)}
                  className={`${INPUT_CLASS} text-center font-mono tracking-widest uppercase`}
                />
                <button
                  type="submit"
                  disabled={!lookupCode.trim()}
                  className="rounded-full bg-gradient-to-r from-fuchsia-500 via-accent to-purple-700 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/50 transition-all duration-200 hover:shadow-[0_0_36px_rgba(168,85,247,0.85)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  Ver mi panel
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
