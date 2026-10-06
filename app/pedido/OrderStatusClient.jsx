"use client";

import { useState } from "react";
import { formatCOP } from "../lib/order";
import { formatDeliveryRange } from "../lib/deliveryEstimate";

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Fecha corta en hora Colombia (UTC-5), sin depender de la zona del navegador.
function formatDay(isoTimestamp) {
  const t = Date.parse(isoTimestamp || "");
  if (!Number.isFinite(t)) return null;
  const d = new Date(t - 5 * 60 * 60 * 1000);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function Step({ title, detail, state }) {
  const dot =
    state === "done"
      ? "bg-accent text-white"
      : state === "current"
        ? "border-2 border-accent bg-white text-accent"
        : "border border-black/15 bg-white text-[#8a94ac]";
  return (
    <li className="flex gap-3">
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${dot}`}>
        {state === "done" ? "✓" : state === "current" ? "•" : ""}
      </span>
      <div>
        <p className={`text-sm font-semibold ${state === "todo" ? "text-[#8a94ac]" : "text-[#1b2a4a]"}`}>{title}</p>
        {detail && <p className="text-xs text-[#5b6b8c]">{detail}</p>}
      </div>
    </li>
  );
}

function StatusCard({ status }) {
  const shipped = status.stage === "despachado";
  const estimate =
    status.estimatedFrom && status.estimatedTo
      ? formatDeliveryRange({ from: status.estimatedFrom, to: status.estimatedTo })
      : null;

  if (status.stage === "sin_cobertura") {
    return (
      <div className="rounded-2xl border border-black/10 bg-[#fffaf0] p-5 text-sm text-[#33456b]">
        <p className="font-semibold text-[#1b2a4a]">Por ahora no tenemos envíos disponibles a tu ciudad.</p>
        <p className="mt-1">
          La devolución de tu dinero ya quedó programada y te enviamos los detalles a tu correo. Si tienes dudas,
          escríbenos a contacto@elmetacho.com.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-[#fffaf0] p-5 shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)]">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-[#33456b]">Tu cuadro</span>
        <span className="font-medium">
          {status.sizeLabel || "-"} · {status.frameLabel}
        </span>
      </div>

      <ol className="flex flex-col gap-3">
        <Step title="Pedido recibido" detail={formatDay(status.receivedAt)} state="done" />
        <Step
          title="En producción"
          detail={shipped ? "Listo" : "Lo estamos fabricando (1-2 días)"}
          state={shipped ? "done" : "current"}
        />
        <Step
          title="Despachado"
          detail={
            shipped
              ? [status.carrierName, formatDay(status.shippedAt)].filter(Boolean).join(" · ")
              : "Te llega un correo con el número de guía"
          }
          state={shipped ? "done" : "todo"}
        />
      </ol>

      {shipped && status.trackingNumber && (
        <div className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm">
          <p className="text-xs uppercase tracking-wide text-[#5b6b8c]">Número de guía</p>
          <p className="font-mono text-base font-bold">{status.trackingNumber}</p>
          {status.trackingUrl && (
            <a
              href={status.trackingUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-2 inline-block rounded-full bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-soft"
            >
              Rastrear mi envío
            </a>
          )}
        </div>
      )}

      {estimate && <p className="text-sm text-[#33456b]">🚚 {estimate} (estimado, sin domingos ni festivos).</p>}

      {status.isCod && status.saldoPendienteCOP > 0 && (
        <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          💵 Saldo a pagar al recibir: <strong>{formatCOP(status.saldoPendienteCOP)}</strong>
        </p>
      )}
    </div>
  );
}

export default function OrderStatusClient({ initialReference = "" }) {
  const [reference, setReference] = useState(initialReference);
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError("");
    setStatus(null);
    try {
      const res = await fetch("/api/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: reference.trim(), phone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.found && data.status) setStatus(data.status);
      else setError(data.error || data.message || "No pudimos consultar tu pedido. Intenta de nuevo.");
    } catch {
      setError("No pudimos consultar tu pedido. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-[#fffaf0] p-5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[#33456b]">Número de pedido</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="mystery-1790000000000"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={80}
            required
            className="rounded-xl border border-black/10 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[#33456b]">Celular (últimos 4 dígitos o completo)</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="1234"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            required
            className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <button
          type="submit"
          disabled={isLoading}
          className="mt-1 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-soft disabled:opacity-60"
        >
          {isLoading ? "Consultando..." : "Consultar estado"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </form>

      {status && <StatusCard status={status} />}
    </div>
  );
}
