"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { formatCOP, SIZES } from "../../lib/order";

// Número de WhatsApp del negocio ("CUADROS MYSTERY") — mismo que se usa
// como contacto de origen para las guías de Skydropx (ver ORIGIN.phone
// en app/lib/skydropx.js), con indicativo de Colombia para el link wa.me.
const WHATSAPP_NUMBER = "573202646716";

const INPUT_CLASS =
  "rounded-xl border border-black/10 bg-[#fffaf0] px-4 py-3.5 text-base outline-none transition-colors duration-200 focus:border-accent focus:ring-1 focus:ring-accent/30 sm:py-3 sm:text-sm";

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

// Fecha larga ("12 de agosto de 2026") para el mensaje de pago recibido
// — más formal/legible que la versión corta usada en las ventas, mismo
// patrón que usan las plataformas de afiliados (fecha completa en el
// historial de pagos, ver investigación en la respuesta al usuario).
function formatDateLong(iso) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ReferidosPanelContent() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code");

  const [codeInput, setCodeInput] = useState(codeFromUrl || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [referral, setReferral] = useState(null);

  const lookupCode = useCallback(async (rawCode) => {
    const code = rawCode.trim().toUpperCase();
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
  }, []);

  // Si se llega desde un enlace tipo /referidos/panel?code=ABC123
  // (ej. el que se comparte en /referidos al generar el código),
  // consultamos automáticamente sin que el usuario tenga que volver
  // a escribirlo.
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

  const whatsappHref = referral
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        `Hola, quiero retirar mi saldo de referido. Mi código es: ${referral.code}. Saldo acumulado: ${formatCOP(
          referral.totalCommission
        )}`
      )}`
    : "";

  // Historial combinado de ventas y pagos ya recibidos, más reciente
  // primero — mismo patrón que usan los dashboards de afiliados
  // (actividad unificada en vez de dos listas separadas), para que se
  // entienda de un vistazo cuándo se ganó cada comisión y cuándo se
  // cobró.
  const totalPaid = referral
    ? (referral.payouts || []).reduce((sum, p) => sum + p.amount, 0)
    : 0;
  // Cuando el saldo sin cobrar vuelve a $0 tras un pago, mostramos el
  // último pago recibido en vez de dejar el silencio de "Sin cobrar:
  // $0" sin contexto — el más reciente de payouts (siempre se agrega al
  // final, ver resetReferralCommission en app/lib/referrals.js).
  const lastPayout =
    referral && referral.totalCommission === 0 && (referral.payouts || []).length > 0
      ? referral.payouts[referral.payouts.length - 1]
      : null;
  const timeline = referral
    ? [
        ...referral.orders.map((o) => ({
          type: "sale",
          date: o.date,
          sizeId: o.sizeId,
          amount: o.commission,
        })),
        ...(referral.payouts || []).map((p) => ({
          type: "payout",
          date: p.date,
          amount: p.amount,
        })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date))
    : [];

  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[#8fcaf0] text-[#1b2a4a]">
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/walls/fondo-cielo-2.webp)" }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-6 px-4 py-16 sm:px-6 sm:py-24">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Tu panel de referido
          </h1>
          <p className="text-sm text-[#33456b]">
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

        {error && <p className="text-sm text-red-600">{error}</p>}

        {referral && (
          <div className="flex w-full flex-col gap-4 animate-ready-in">
            <div className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-[#fffaf0] p-5 shadow-[0_0_40px_-14px_rgba(168,85,247,0.3)] sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#33456b]">Embajador</p>
                  <p className="text-lg font-semibold text-[#1b2a4a]">{referral.name}</p>
                </div>
                <span className="rounded-full bg-accent/15 px-3 py-1 font-mono text-xs font-medium tracking-wider text-accent">
                  {referral.code}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-black/10 pt-4 sm:gap-3">
                <div className="rounded-xl border border-black/10 bg-[#fffaf0] p-3 text-center">
                  <p className="text-[11px] text-[#33456b] sm:text-xs">Ventas</p>
                  <p className="text-lg font-bold text-[#1b2a4a] sm:text-xl">
                    {referral.totalSales}
                  </p>
                </div>
                <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-center">
                  <p className="text-[11px] text-[#33456b] sm:text-xs">Sin cobrar</p>
                  <p className="text-lg font-bold text-accent sm:text-xl">
                    {formatCOP(referral.totalCommission)}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                  <p className="text-[11px] text-[#33456b] sm:text-xs">Cobrado</p>
                  <p className="text-lg font-bold text-emerald-700 sm:text-xl">
                    {formatCOP(totalPaid)}
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

            {lastPayout && (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-700">
                ✅ Recibiste tu último pago: {formatCOP(lastPayout.amount)} el{" "}
                {formatDateLong(lastPayout.date)}
              </p>
            )}

            <div className="rounded-2xl border border-black/10 bg-[#fffaf0] p-5 sm:p-6">
              <h2 className="mb-4 text-sm font-medium text-[#33456b]">Historial</h2>
              {timeline.length === 0 ? (
                <p className="text-sm text-[#5b6b8c]">
                  Todavía no tienes ventas registradas — comparte tu código para empezar
                  a ganar.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {timeline.map((item, i) =>
                    item.type === "payout" ? (
                      <li
                        key={i}
                        className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span aria-hidden="true">💸</span>
                          <span className="text-[#33456b]">
                            Recibiste un pago el {formatDateLong(item.date)}
                          </span>
                        </div>
                        <span className="font-semibold text-emerald-700">
                          {formatCOP(item.amount)}
                        </span>
                      </li>
                    ) : (
                      <li
                        key={i}
                        className="flex items-center justify-between rounded-xl border border-black/10 bg-[#fffaf0] px-4 py-3 text-sm"
                      >
                        <div className="flex flex-col">
                          <span className="text-[#1b2a4a]">{sizeLabel(item.sizeId)}</span>
                          <span className="text-xs text-[#5b6b8c]">
                            {formatDate(item.date)}
                          </span>
                        </div>
                        <span className="font-semibold text-accent">
                          +{formatCOP(item.amount)}
                        </span>
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReferidosPanelPage() {
  return (
    <Suspense fallback={null}>
      <ReferidosPanelContent />
    </Suspense>
  );
}
