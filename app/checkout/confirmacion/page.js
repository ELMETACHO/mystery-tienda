"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { formatCOP, loadOrder, saveOrder } from "../../lib/order";

// Morado de marca + blanco/dorado, para que el confeti se sienta "Mystery"
// y no genérico.
const CONFETTI_COLORS = ["#a855f7", "#c084fc", "#ffffff", "#f5d576"];

// Sin cuenta de Instagram real configurada en el proyecto todavía —
// placeholder hasta que se defina el usuario/link oficial de Mystery.
const INSTAGRAM_URL = "#";

function getTimeline(order) {
  const isCod = order?.metodo_pago === "contraentrega";
  return [
    {
      label: isCod ? "Anticipo confirmado" : "Pago confirmado",
      detail: isCod ? "Ya recibimos tu anticipo" : "Ya recibimos tu pago",
    },
    { label: "En producción", detail: "3-5 días hábiles" },
    {
      label: "En camino a tu casa",
      detail: isCod
        ? "Pagas el saldo al recibir tu cuadro"
        : "Según tiempo de envío",
    },
  ];
}

function shippingAddress(customer) {
  if (!customer) return "";
  const housing =
    customer.housingType === "apartamento"
      ? [
          customer.buildingName && `Edificio ${customer.buildingName}`,
          customer.tower && `Torre ${customer.tower}`,
          customer.apartmentNumber && `Apto ${customer.apartmentNumber}`,
        ]
          .filter(Boolean)
          .join(", ")
      : customer.additionalInstructions;

  return [customer.street, housing, customer.neighborhood, customer.city]
    .filter(Boolean)
    .join(", ");
}

export default function ConfirmacionPage() {
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [couponRevealed, setCouponRevealed] = useState(false);
  const [showLoyaltyGift, setShowLoyaltyGift] = useState(false);
  const hasCelebratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadOrder();
      if (cancelled) return;

      // TEMPORAL: estructura completa del pedido guardado, para
      // confirmar cómo llega realmente en móvil. Quitar una vez
      // diagnosticado.
      console.log("[confirmacion] order completo:", JSON.stringify(stored));

      // Wompi redirigió aquí directamente (redirectUrl del widget, ver
      // /checkout) en vez de que el callback del navegador confirmara el
      // pago antes de navegar — pasa cuando el cliente nunca vuelve a la
      // pestaña original por su cuenta. Si detectamos ?id=<transactionId>
      // y el pedido guardado todavía no quedó como APROBADO, confirmamos
      // acá mismo con la misma ruta idempotente que usa ese callback y el
      // webhook — es seguro aunque los tres lleguen a confirmar la misma
      // transacción (confirmApprovedOrder solo hace el trabajo una vez).
      const transactionId = new URLSearchParams(window.location.search).get("id");

      if (transactionId && stored?.customer && stored.payment?.status !== "APPROVED") {
        try {
          const res = await fetch("/api/confirm-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transactionId,
              order: stored,
              customer: stored.customer,
            }),
          });
          const confirmation = await res.json();
          if (res.ok) {
            const updated = {
              ...stored,
              payment: {
                reference: confirmation.reference,
                status: confirmation.status,
                id: transactionId,
              },
              cliente_recurrente: Boolean(confirmation.isReturningCustomer),
            };
            await saveOrder(updated);
            if (!cancelled) {
              setOrder(updated);
              setIsLoading(false);
            }
            return;
          }
          console.error("[confirmacion] Falló la confirmación vía auto-redirect:", confirmation);
        } catch (err) {
          console.error("[confirmacion] Error confirmando el pago vía auto-redirect:", err);
        }
      }

      if (!cancelled) {
        setOrder(stored);
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Confeti cayendo, una sola vez, solo si el pago quedó realmente
  // aprobado (no confiamos en "llegó a esta página" como señal de éxito).
  // Usa un canvas propio con pointer-events:none para que nunca bloquee
  // clics sobre el resto de la página, y se limpia solo al terminar.
  useEffect(() => {
    console.log("[confeti] order.payment?.status =", order?.payment?.status);

    if (hasCelebratedRef.current) return;
    if (!order || order.payment?.status !== "APPROVED") return;
    hasCelebratedRef.current = true;

    let canvas;
    let cleanupTimer;

    try {
      console.log("[confeti] Pago aprobado, creando canvas...");

      canvas = document.createElement("canvas");
      canvas.style.position = "fixed";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100vw";
      // 100vh como respaldo para navegadores sin soporte de unidades dvh;
      // si dvh es válida, la segunda asignación la sobrescribe. En Safari
      // iOS, con la barra de navegador dinámica, 100vh puede no cubrir el
      // viewport visible real y dejar el confeti recortado/oculto.
      canvas.style.height = "100vh";
      canvas.style.height = "100dvh";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "9999";
      document.body.appendChild(canvas);

      console.log(
        "[confeti] Canvas agregado al DOM:",
        canvas.style.width,
        canvas.style.height
      );

      // useWorker:true depende de OffscreenCanvas, que en varios
      // navegadores móviles (sobre todo Safari/iOS) tiene soporte
      // inconsistente y hacía que el confeti nunca se dibujara en el
      // celular. Con useWorker:false se dibuja siempre en el hilo
      // principal, funciona en todos lados.
      const fireConfetti = confetti.create(canvas, {
        resize: true,
        useWorker: false,
      });

      console.log("[confeti] Instancia de confetti creada, iniciando animación...");

      const durationMs = 7500;
      const endTime = Date.now() + durationMs;

      const frame = () => {
        try {
          fireConfetti({
            particleCount: 5,
            startVelocity: 42,
            spread: 80,
            gravity: 0.7,
            ticks: 400,
            scalar: 0.95,
            colors: CONFETTI_COLORS,
            origin: { x: Math.random(), y: -0.1 },
          });
        } catch (frameErr) {
          console.error("[confeti] Error disparando una tanda de partículas:", frameErr);
          return;
        }
        if (Date.now() < endTime) {
          requestAnimationFrame(frame);
        }
      };
      frame();

      // Margen extra para que las últimas partículas terminen de caer
      // fuera de pantalla antes de quitar el canvas.
      cleanupTimer = setTimeout(() => {
        canvas.remove();
      }, durationMs + 3000);
    } catch (err) {
      console.error("[confeti] Error creando el canvas o iniciando la animación:", err);
    }

    return () => {
      clearTimeout(cleanupTimer);
      canvas?.remove();
    };
  }, [order]);

  // El regalo de cliente recurrente aparece gradualmente (fade-in) unos
  // segundos después de cargar, en vez de golpear la vista de una — se
  // siente como un gesto cálido, no como un CTA de venta agresivo.
  useEffect(() => {
    if (!order?.cliente_recurrente) return;
    const timer = setTimeout(() => setShowLoyaltyGift(true), 2500);
    return () => clearTimeout(timer);
  }, [order]);

  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col items-center gap-6 px-4 py-12 text-center sm:px-6 sm:py-16">
        {/* 1. Confirmación central */}
        <div className="flex h-16 w-16 animate-ready-in items-center justify-center rounded-full bg-accent/15 text-3xl text-accent-soft">
          ✓
        </div>
        <div className="animate-ready-in flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            ¡Gracias!
          </h1>
          <p className="text-lg font-medium text-zinc-200 sm:text-xl">
            ¡Tu cuadro Mystery está en camino!
          </p>
        </div>

        {isLoading ? (
          <p className="text-sm text-zinc-500">Cargando tu pedido...</p>
        ) : order ? (
          <>
            {/* 2. Resumen del pedido — tarjeta de producto premium, mismo
                tratamiento que /checkout. El badge y el confeti comparten
                ahora la misma fuente de verdad: order.payment?.status. */}
            <div className="flex w-full flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left shadow-[0_0_40px_-14px_rgba(168,85,247,0.3)] sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-zinc-300">Tu pedido</h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    order.payment?.status === "APPROVED"
                      ? "bg-accent/15 text-accent-soft"
                      : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {order.payment?.status === "APPROVED"
                    ? "Confirmado"
                    : "Verificando pago"}
                </span>
              </div>

              <div className="flex gap-4">
                {order.croppedImage && (
                  <img
                    src={order.croppedImage}
                    alt="Preview del cuadro"
                    className="h-20 w-20 shrink-0 rounded-xl border border-white/10 object-cover shadow-lg shadow-black/40"
                  />
                )}
                <div className="flex flex-1 flex-col justify-center gap-1">
                  <span className="text-sm font-medium text-zinc-200">
                    {order.sizeLabel}
                  </span>
                  <span className="text-xl font-bold text-accent-soft">
                    {formatCOP(order.priceCOP)}
                  </span>
                </div>
              </div>

              {order.metodo_pago === "contraentrega" && (
                <div className="flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-300">Anticipo pagado</span>
                    <span className="font-semibold text-emerald-300">
                      {formatCOP(order.anticipo_pagado)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-300">Saldo al recibir tu cuadro</span>
                    <span className="font-semibold text-white">
                      {formatCOP(order.saldo_pendiente)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 border-t border-white/10 pt-3 text-sm">
                {order.payment?.reference && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0 text-zinc-400">Referencia</span>
                    <span className="break-all text-right text-zinc-200">
                      {order.payment.reference}
                    </span>
                  </div>
                )}
                {order.customer && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="shrink-0 text-zinc-400">Envío a</span>
                    <span className="text-right text-zinc-200">
                      {shippingAddress(order.customer)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Regalo para clientes recurrentes (detectado vía historial en
                Redis) — aparece con fade-in unos segundos después de
                cargar, nunca para clientes nuevos. Va justo después del
                resumen del pedido para que se sienta como un momento
                especial, no un aviso al final de la página. */}
            {order.cliente_recurrente && (
              <div
                className={`w-full rounded-2xl border border-dashed border-accent/40 bg-accent/5 p-6 text-center transition-opacity duration-700 sm:p-8 ${
                  showLoyaltyGift ? "opacity-100" : "opacity-0"
                }`}
              >
                {couponRevealed ? (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-lg font-semibold text-accent-soft sm:text-xl">
                      ¡Felicidades! Tienes 10% de descuento en tu próxima compra
                    </p>
                    <span className="rounded-lg border border-accent/50 bg-white/5 px-5 py-2.5 font-mono text-base tracking-wider text-white">
                      MYSTERY10%
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex flex-col gap-1.5">
                      <p className="text-2xl font-extrabold uppercase tracking-tight text-accent-soft sm:text-3xl">
                        ¡Eres cliente fiel! 🎉
                      </p>
                      <p className="text-base text-zinc-300 sm:text-lg">
                        Te regalamos un descuento exclusivo
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCouponRevealed(true)}
                      className="rounded-full border border-accent/50 px-7 py-3 text-base font-medium text-accent-soft transition-colors hover:bg-accent/10"
                    >
                      🎁 Reclamar mi descuento del 10%
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3. Línea de tiempo / próximos pasos */}
            <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left sm:p-6">
              <h2 className="mb-4 text-sm font-medium text-zinc-300">
                Próximos pasos
              </h2>
              <ol className="flex flex-col gap-0">
                {getTimeline(order).map((step, i, timeline) => {
                  const isDone = i === 0;
                  const isLast = i === timeline.length - 1;
                  return (
                    <li key={step.label} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            isDone
                              ? "bg-emerald-500 text-white"
                              : "border-2 border-white/15 text-zinc-500"
                          }`}
                        >
                          {isDone ? "✓" : i + 1}
                        </span>
                        {!isLast && (
                          <span
                            className={`w-px flex-1 ${
                              isDone ? "bg-emerald-500/40" : "bg-white/10"
                            }`}
                            style={{ minHeight: "28px" }}
                          />
                        )}
                      </div>
                      <div className={isLast ? "pb-0" : "pb-5"}>
                        <p
                          className={`text-sm font-medium ${
                            isDone ? "text-white" : "text-zinc-300"
                          }`}
                        >
                          {step.label}
                        </p>
                        <p className="text-xs text-zinc-500">{step.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* 4. Confirmación de correo */}
            {order.customer?.email && (
              <p className="text-xs text-zinc-500">
                Enviamos un correo de confirmación a{" "}
                <span className="text-zinc-300">{order.customer.email}</span>{" "}
                por si quieres guardarlo. En 1-2 días te llegará otro correo
                con la guía para hacer seguimiento de tu envío.
              </p>
            )}
          </>
        ) : null}

        {/* 5. CTAs secundarios */}
        <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="w-full max-w-xs rounded-full bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-soft sm:w-auto"
          >
            Volver a Mystery
          </Link>
          <Link
            href={INSTAGRAM_URL}
            target={INSTAGRAM_URL !== "#" ? "_blank" : undefined}
            rel={INSTAGRAM_URL !== "#" ? "noopener noreferrer" : undefined}
            className="w-full max-w-xs rounded-full border border-white/15 px-6 py-3 text-sm text-zinc-300 transition-colors hover:border-white/30 sm:w-auto"
          >
            📸 Síguenos en Instagram
          </Link>
        </div>

        {/* 6. Agradecimiento cálido */}
        <p className="text-xs text-zinc-600">Gracias por confiar en Mystery</p>
      </div>
    </div>
  );
}
