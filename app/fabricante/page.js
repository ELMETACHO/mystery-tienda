"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { formatCOP, SIZES } from "../lib/order";
import PasswordInput from "../components/PasswordInput";

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

// Fila de un pedido, con sus propios botones "Cancelar guía"/"Generar
// guía nueva" — cada uno maneja su propio estado (formulario de motivo,
// carga, confirmación) sin afectar al resto de la lista. `code` es el
// código de acceso ya validado (mismo que /api/fabricante-status), se
// reenvía en cada acción porque estos endpoints no usan cookie de sesión.
function OrderRow({ order, code, onUpdated }) {
  const [o, setO] = useState(order);
  const [isCancelling, setIsCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const status = o.status || "activo";

  const handleConfirmCancel = async () => {
    if (!reason.trim()) return;
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/fabricante-cancel-shipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, reference: o.reference, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo cancelar la guía");
      const updated = json.order || { ...o, status: "cancelado" };
      setO(updated);
      onUpdated(updated);
      setIsCancelling(false);
      setReason("");
      setMessage("✅ Guía cancelada, se le notificó a Mystery");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateNew = async () => {
    if (
      !confirm(
        "¿Estás seguro de generar una guía nueva? Recuerda que si lo haces, el pedido debe entregarse a la transportadora HOY mismo."
      )
    )
      return;
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/fabricante-generate-shipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, reference: o.reference }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo generar la guía");
      const updated = json.order || { ...o, status: "activo" };
      setO(updated);
      onUpdated(updated);
      setMessage("✅ Guía nueva generada");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-[#fffaf0] p-4">
      <div className="flex items-center gap-4">
        {o.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={o.thumbnailUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg border border-black/10 object-cover"
          />
        ) : (
          // Pedidos personalizados de /crear no guardan la foto
          // completa (pesa demasiado para conservarla 30 días, ver
          // CLAUDE.md) — ícono genérico en vez de un hueco roto/vacío.
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-[#fffaf0] text-2xl">
            🖼️
          </div>
        )}
        <div className="flex flex-1 flex-col">
          <span className="font-medium text-[#1b2a4a]">{o.cliente}</span>
          <span className="text-xs text-[#5b6b8c]">{sizeLabel(o.sizeId)}</span>
          <span className="mt-1 text-xs text-[#5b6b8c]">{formatDate(o.fecha)}</span>
          {o.guideUrl && status === "activo" && (
            <a
              href={o.guideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-xs text-accent underline underline-offset-2"
            >
              Ver guía
            </a>
          )}
          {status === "cancelado" && (
            <span className="mt-1 text-xs font-medium text-red-600">
              Guía cancelada{o.cancelReason ? `: ${o.cancelReason}` : ""}
            </span>
          )}
        </div>
        <span className="shrink-0 text-lg font-bold text-accent">{formatCOP(o.monto)}</span>
      </div>

      {!message && status === "activo" && o.guideUrl && !isCancelling && (
        <button
          type="button"
          onClick={() => setIsCancelling(true)}
          className="self-start rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-500/20"
        >
          Cancelar guía
        </button>
      )}

      {!message && isCancelling && (
        <div className="flex flex-col gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <label className="text-xs font-medium text-red-700">
            ¿Qué pasó? (obligatorio antes de cancelar)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="rounded-lg border border-black/10 bg-[#fffaf0] px-3 py-2 text-sm outline-none transition-colors focus:border-red-400 focus:ring-1 focus:ring-red-400/30"
            placeholder="Ej. el cliente pidió cambiar la dirección, el cuadro se dañó, etc."
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmCancel}
              disabled={isSubmitting || !reason.trim()}
              className="rounded-full bg-red-500 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? "Cancelando..." : "Confirmar cancelación"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCancelling(false);
                setReason("");
                setError("");
              }}
              disabled={isSubmitting}
              className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-medium text-[#33456b] transition-colors hover:text-[#1b2a4a]"
            >
              Volver
            </button>
          </div>
        </div>
      )}

      {!message && status === "cancelado" && (
        <button
          type="button"
          onClick={handleGenerateNew}
          disabled={isSubmitting}
          className="self-start rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting ? "Generando..." : "Generar guía nueva"}
        </button>
      )}

      {message && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700">
          {message}
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </li>
  );
}

// Vista de solo lectura para el fabricante, protegida con un código
// simple por fabricante (FABRICANTE_ACCESS_CODE_PREMIUM /
// FABRICANTE_ACCESS_CODE_TRADICIONAL, ver app/api/fabricante-status/route.js
// y app/lib/fabricantes.js) en vez de ADMIN_PASSWORD — mismo patrón que
// /referidos/panel. El código identifica a qué fabricante pertenece, así
// que cada uno solo ve sus propios pedidos. Sin CRM ni botón de marcar
// como pagado; SÍ puede cancelar/regenerar sus propias guías (ver
// OrderRow arriba).
function FabricanteContent() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code");

  const [codeInput, setCodeInput] = useState(codeFromUrl || "");
  const [activeCode, setActiveCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [isRequestingPayment, setIsRequestingPayment] = useState(false);
  const [paymentRequestMessage, setPaymentRequestMessage] = useState("");

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
      setActiveCode(code);
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

  const handleRequestPayment = async () => {
    setIsRequestingPayment(true);
    setPaymentRequestMessage("");
    try {
      const res = await fetch("/api/fabricante-request-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: activeCode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPaymentRequestMessage(json.error || "No se pudo enviar la solicitud");
        return;
      }
      setPaymentRequestMessage("✅ Solicitud enviada");
    } catch (err) {
      console.error(err);
      setPaymentRequestMessage("No se pudo enviar la solicitud. Intenta de nuevo.");
    } finally {
      setIsRequestingPayment(false);
    }
  };

  const handleOrderUpdated = (updated) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            orders: prev.orders.map((o) => (o.reference === updated.reference ? updated : o)),
          }
        : prev
    );
  };

  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[#8fcaf0] text-[#1b2a4a]">
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/walls/fondo-cielo-2.webp)" }}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-6 px-4 py-16 sm:px-6 sm:py-24">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Tu saldo pendiente</h1>
        <p className="text-sm text-[#33456b]">Ingresa tu código de acceso para consultarlo.</p>
      </div>

      <form onSubmit={handleLookup} className="flex w-full gap-2">
        <div className="flex-1">
          <PasswordInput
            placeholder="Código de acceso"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            className="rounded-xl border border-black/10 bg-[#fffaf0] px-4 py-3.5 text-base text-[#1b2a4a] outline-none transition-colors duration-200 focus:border-accent focus:ring-1 focus:ring-accent/30 sm:py-3 sm:text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !codeInput.trim()}
          className="shrink-0 rounded-xl bg-gradient-to-r from-fuchsia-500 via-accent to-purple-700 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/50 transition-all duration-200 hover:shadow-[0_0_36px_rgba(168,85,247,0.85)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:py-3"
        >
          {isLoading ? "Consultando..." : "Ver saldo"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <div className="flex w-full flex-col gap-4 animate-ready-in">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-5 text-center shadow-[0_0_40px_-14px_rgba(168,85,247,0.3)] sm:p-6">
            <div>
              <p className="text-sm text-[#33456b]">Total pendiente</p>
              <p className="text-2xl font-bold text-accent sm:text-3xl">
                {formatCOP(data.balance)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRequestPayment}
              disabled={isRequestingPayment}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isRequestingPayment ? "Enviando..." : "💰 Cobrar saldo"}
            </button>
            {paymentRequestMessage && (
              <p
                className={`text-xs font-medium ${
                  paymentRequestMessage.startsWith("✅") ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {paymentRequestMessage}
              </p>
            )}
          </div>

          {data.balance === 0 && data.lastPayment && (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-700">
              ✅ Recibiste tu último pago: {formatCOP(data.lastPayment.amount)} el{" "}
              {formatDate(data.lastPayment.date)}
            </p>
          )}

          <p className="text-center text-xs text-[#5b6b8c]">
            Verás todos tus pedidos una vez generes la guía, no antes.
          </p>

          {data.orders.length === 0 ? (
            <p className="rounded-xl border border-black/10 bg-[#fffaf0] px-4 py-6 text-center text-sm text-[#5b6b8c]">
              No hay saldo pendiente.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.orders.map((o) => (
                <OrderRow key={o.reference} order={o} code={activeCode} onUpdated={handleOrderUpdated} />
              ))}
            </ul>
          )}
        </div>
      )}
      </div>
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
