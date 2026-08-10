"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { COD_DEPOSIT_COP, formatCOP, loadOrder, saveOrder } from "../lib/order";
import FreeShippingBanner from "../components/FreeShippingBanner";

const WOMPI_PUBLIC_KEY = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;

const emptyCustomer = {
  fullName: "",
  email: "",
  phonePrefix: "+57",
  phone: "",
  street: "",
  housingType: "casa", // "casa" | "apartamento"
  buildingName: "",
  tower: "",
  apartmentNumber: "",
  additionalInstructions: "",
  neighborhood: "",
  city: "",
  department: "",
  postalCode: "",
};

// Los 32 departamentos de Colombia + Bogotá D.C. — Skydropx requiere
// area_level1 (departamento) para cotizar envíos dentro de Colombia; el
// código postal (postal_code) no es estrictamente obligatorio según su
// documentación de direcciones (basta con area_level1/area_level2 para
// cotizar), así que se deja como campo opcional.
const DEPARTMENTS_CO = [
  "Amazonas",
  "Antioquia",
  "Arauca",
  "Atlántico",
  "Bogotá D.C.",
  "Bolívar",
  "Boyacá",
  "Caldas",
  "Caquetá",
  "Casanare",
  "Cauca",
  "Cesar",
  "Chocó",
  "Córdoba",
  "Cundinamarca",
  "Guainía",
  "Guaviare",
  "Huila",
  "La Guajira",
  "Magdalena",
  "Meta",
  "Nariño",
  "Norte de Santander",
  "Putumayo",
  "Quindío",
  "Risaralda",
  "San Andrés y Providencia",
  "Santander",
  "Sucre",
  "Tolima",
  "Valle del Cauca",
  "Vaupés",
  "Vichada",
];

const HOUSING_TYPES = [
  { id: "casa", label: "Casa" },
  { id: "apartamento", label: "Apartamento" },
];

const PAYMENT_METHODS = [
  { id: "wompi", label: "Pagar en línea", detail: "Tarjeta / PSE con Wompi" },
  {
    id: "cod",
    label: "Pago contraentrega",
    detail: `Anticipo de ${formatCOP(COD_DEPOSIT_COP)} + saldo en efectivo`,
  },
];

const PHONE_PREFIXES = [
  { code: "+57", label: "+57 Colombia" },
  { code: "+1", label: "+1 EE. UU. / Canadá" },
  { code: "+52", label: "+52 México" },
  { code: "+51", label: "+51 Perú" },
  { code: "+56", label: "+56 Chile" },
  { code: "+54", label: "+54 Argentina" },
  { code: "+593", label: "+593 Ecuador" },
  { code: "+34", label: "+34 España" },
];

// Mismo tratamiento premium de /crear: bordes sutiles, foco con anillo
// morado y transición suave.
const INPUT_CLASS =
  "rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-base outline-none transition-colors duration-200 focus:border-accent focus:ring-1 focus:ring-accent/30 sm:py-3 sm:text-sm";

// Botones de pago: el color/gradiente/sombra intensos y la respiración
// sutil (ver .animate-pay-breathe en globals.css) buscan que sea el
// elemento que más llama la atención de la pantalla — es la acción
// principal que el cliente debe tomar.
const PAY_BUTTON_CLASS =
  "mt-1 w-full rounded-full bg-gradient-to-r from-fuchsia-500 via-accent to-purple-700 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/50 transition-all duration-200 hover:shadow-[0_0_36px_rgba(168,85,247,0.85)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:animate-none";

export default function CheckoutPage() {
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [isWidgetReady, setIsWidgetReady] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("wompi"); // "wompi" | "cod"
  const [isConfirmingCod, setIsConfirmingCod] = useState(false);
  const widgetRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await loadOrder();
      if (cancelled) return;

      if (!stored || !stored.croppedImage) {
        router.replace("/crear");
        return;
      }
      setOrder(stored);
      setIsLoadingOrder(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (isLoadingOrder || !order) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <p className="text-zinc-400">Cargando tu pedido...</p>
      </div>
    );
  }

  const isFormValid =
    customer.fullName.trim() &&
    customer.email.trim() &&
    customer.phonePrefix.trim() &&
    customer.phone.trim() &&
    customer.street.trim() &&
    customer.neighborhood.trim() &&
    customer.city.trim() &&
    customer.department.trim() &&
    (customer.housingType === "apartamento"
      ? customer.buildingName.trim() && customer.apartmentNumber.trim()
      : true);

  const isCodDisabled = !isFormValid || !isWidgetReady || isConfirmingCod;
  const isWompiDisabled = !isFormValid || !isWidgetReady || isPaying;

  const handleChange = (field) => (e) =>
    setCustomer((prev) => ({ ...prev, [field]: e.target.value }));

  const setHousingType = (housingType) =>
    setCustomer((prev) => ({ ...prev, housingType }));

  const handlePay = async () => {
    if (!isFormValid || !isWidgetReady || !window.WidgetCheckout) return;
    setPayError("");
    setIsPaying(true);

    const fullOrder = { ...order, customer };
    await saveOrder(fullOrder);

    const reference = `mystery-${Date.now()}`;
    const amountInCents = order.priceCOP * 100;
    const currency = "COP";

    // Guardado en Redis por `reference`, ANTES de pagar — red de
    // seguridad para que /api/wompi-webhook pueda confirmar el pedido
    // más adelante aunque el cliente nunca regrese a esta pestaña. No
    // es fatal si falla: el camino normal (este mismo flujo) no depende
    // de esto para funcionar, así que un error acá nunca debe impedir
    // que el cliente pague.
    fetch("/api/save-pending-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, order: fullOrder, customer }),
    }).catch((err) => {
      console.error("[checkout] No se pudo guardar el pedido pendiente:", err);
    });

    let signature;
    try {
      const res = await fetch("/api/wompi-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, amountInCents, currency }),
      });
      if (!res.ok) throw new Error("No se pudo generar la firma");
      ({ signature } = await res.json());
    } catch (err) {
      console.error(err);
      setPayError("No se pudo iniciar el pago. Intenta de nuevo.");
      setIsPaying(false);
      return;
    }

    widgetRef.current = new window.WidgetCheckout({
      currency,
      amountInCents,
      reference,
      publicKey: WOMPI_PUBLIC_KEY,
      signature: { integrity: signature },
      customerData: {
        email: customer.email,
        fullName: customer.fullName,
        phoneNumber: customer.phone,
        phoneNumberPrefix: customer.phonePrefix,
      },
    });

    widgetRef.current.open(async (result) => {
      const transaction = result?.transaction;
      console.log("Resultado de Wompi (navegador):", transaction);

      if (
        !transaction?.id ||
        transaction.status === "DECLINED" ||
        transaction.status === "ERROR"
      ) {
        setIsPaying(false);
        setPayError("El pago no se pudo procesar. Puedes intentarlo de nuevo.");
        return;
      }

      // No confiamos en el estado que reporta el navegador: el servidor
      // vuelve a consultar la transacción directamente en Wompi antes de
      // dar el pedido por confirmado y disparar los correos.
      let confirmation;
      try {
        const res = await fetch("/api/confirm-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionId: transaction.id,
            order: fullOrder,
            customer,
          }),
        });
        confirmation = await res.json();
        if (!res.ok) throw new Error(confirmation.error || "Verificación fallida");
      } catch (err) {
        console.error(err);
        setIsPaying(false);
        setPayError(
          "No pudimos confirmar tu pago con Wompi. Si el cobro se realizó, contáctanos."
        );
        return;
      }

      setIsPaying(false);
      await saveOrder({
        ...fullOrder,
        payment: {
          reference: confirmation.reference,
          status: confirmation.status,
          id: transaction.id,
        },
        cliente_recurrente: Boolean(confirmation.isReturningCustomer),
      });

      router.push("/checkout/confirmacion");
    });
  };

  // Pago contraentrega: NO cobra el precio completo por Wompi — solo el
  // anticipo fijo (COD_DEPOSIT_COP), con el mismo widget y el mismo patrón
  // de verificación server-side que el pago completo. El saldo restante
  // se paga en efectivo al recibir el cuadro.
  const handlePayCod = async () => {
    if (!isFormValid || !isWidgetReady || !window.WidgetCheckout) return;
    setPayError("");
    setIsConfirmingCod(true);

    const fullOrder = { ...order, customer };
    await saveOrder(fullOrder);

    const reference = `mystery-cod-${Date.now()}`;
    const amountInCents = COD_DEPOSIT_COP * 100;
    const currency = "COP";

    let signature;
    try {
      const res = await fetch("/api/wompi-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, amountInCents, currency }),
      });
      if (!res.ok) throw new Error("No se pudo generar la firma");
      ({ signature } = await res.json());
    } catch (err) {
      console.error(err);
      setPayError("No se pudo iniciar el pago del anticipo. Intenta de nuevo.");
      setIsConfirmingCod(false);
      return;
    }

    widgetRef.current = new window.WidgetCheckout({
      currency,
      amountInCents,
      reference,
      publicKey: WOMPI_PUBLIC_KEY,
      signature: { integrity: signature },
      customerData: {
        email: customer.email,
        fullName: customer.fullName,
        phoneNumber: customer.phone,
        phoneNumberPrefix: customer.phonePrefix,
      },
    });

    widgetRef.current.open(async (result) => {
      const transaction = result?.transaction;
      console.log("Resultado de Wompi (anticipo contraentrega):", transaction);

      if (
        !transaction?.id ||
        transaction.status === "DECLINED" ||
        transaction.status === "ERROR"
      ) {
        setIsConfirmingCod(false);
        setPayError("El anticipo no se pudo procesar. Puedes intentarlo de nuevo.");
        return;
      }

      let confirmation;
      try {
        const res = await fetch("/api/confirm-cod-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionId: transaction.id,
            order: fullOrder,
            customer,
          }),
        });
        confirmation = await res.json();
        if (!res.ok) throw new Error(confirmation.error || "Verificación fallida");
      } catch (err) {
        console.error(err);
        setIsConfirmingCod(false);
        setPayError(
          "No pudimos confirmar tu anticipo con Wompi. Si el cobro se realizó, contáctanos."
        );
        return;
      }

      setIsConfirmingCod(false);
      await saveOrder({
        ...fullOrder,
        payment: {
          reference: confirmation.reference,
          status: confirmation.status,
          id: transaction.id,
          method: "contraentrega",
        },
        metodo_pago: "contraentrega",
        anticipo_pagado: confirmation.anticipoPagado,
        saldo_pendiente: confirmation.saldoPendiente,
        trackingNumber: confirmation.trackingNumber || null,
        carrierName: confirmation.carrierName || null,
        cliente_recurrente: Boolean(confirmation.isReturningCustomer),
      });

      router.push("/checkout/confirmacion");
    });
  };

  return (
    <>
      <Script
        src="https://checkout.wompi.co/widget.js"
        strategy="afterInteractive"
        onReady={() => setIsWidgetReady(true)}
      />

      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--accent)" }}
        />

        <div className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col gap-3 px-4 py-4 sm:gap-10 sm:px-6 sm:py-16">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            Finaliza tu pedido
          </h1>
          <p className="mt-1 text-sm text-zinc-400 sm:mt-2 sm:text-base">
            Completa tus datos de envío y paga con Wompi (modo prueba).
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:gap-8 lg:flex-row">
          <div className="order-2 flex flex-1 flex-col gap-3 sm:gap-4 lg:order-1">
            <h2 className="text-sm font-medium text-zinc-300">Tus datos</h2>

            <input
              type="text"
              placeholder="Nombre y apellido"
              value={customer.fullName}
              onChange={handleChange("fullName")}
              className={INPUT_CLASS}
            />
            <input
              type="email"
              placeholder="Correo electrónico"
              value={customer.email}
              onChange={handleChange("email")}
              className={INPUT_CLASS}
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={customer.phonePrefix}
                onChange={handleChange("phonePrefix")}
                className={`${INPUT_CLASS} sm:w-44`}
              >
                {PHONE_PREFIXES.map((p) => (
                  <option key={p.code} value={p.code} className="bg-zinc-900">
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                placeholder="Celular"
                value={customer.phone}
                onChange={handleChange("phone")}
                className={`flex-1 ${INPUT_CLASS}`}
              />
            </div>

            <h2 className="mt-2 text-sm font-medium text-zinc-300">
              Dirección de envío
            </h2>
            <input
              type="text"
              placeholder="Dirección (calle/carrera y número)"
              value={customer.street}
              onChange={handleChange("street")}
              className={INPUT_CLASS}
            />

            <div>
              <p className="mb-2 text-xs font-medium text-zinc-400">
                ¿Casa o apartamento?
              </p>
              <div className="grid grid-cols-2 gap-3">
                {HOUSING_TYPES.map((option) => {
                  const isSelected = customer.housingType === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setHousingType(option.id)}
                      className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                        isSelected
                          ? "border-accent bg-accent/15 text-white shadow-[0_0_0_1px_rgba(168,85,247,0.6),0_0_20px_rgba(168,85,247,0.25)]"
                          : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {customer.housingType === "apartamento" ? (
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Nombre del edificio"
                  value={customer.buildingName}
                  onChange={handleChange("buildingName")}
                  className={INPUT_CLASS}
                />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    placeholder="Torre"
                    value={customer.tower}
                    onChange={handleChange("tower")}
                    className={`flex-1 ${INPUT_CLASS}`}
                  />
                  <input
                    type="text"
                    placeholder="Apartamento"
                    value={customer.apartmentNumber}
                    onChange={handleChange("apartmentNumber")}
                    className={`flex-1 ${INPUT_CLASS}`}
                  />
                </div>
              </div>
            ) : (
              <textarea
                placeholder="Indicaciones adicionales (color de la casa, referencias cercanas, etc.)"
                value={customer.additionalInstructions}
                onChange={handleChange("additionalInstructions")}
                rows={2}
                className={`resize-none ${INPUT_CLASS}`}
              />
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                placeholder="Barrio"
                value={customer.neighborhood}
                onChange={handleChange("neighborhood")}
                className={`flex-1 ${INPUT_CLASS}`}
              />
              <input
                type="text"
                placeholder="Ciudad"
                value={customer.city}
                onChange={handleChange("city")}
                className={`flex-1 ${INPUT_CLASS}`}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={customer.department}
                onChange={handleChange("department")}
                className={`flex-1 ${INPUT_CLASS} ${
                  customer.department ? "" : "text-zinc-500"
                }`}
              >
                <option value="" disabled className="bg-zinc-900">
                  Departamento
                </option>
                {DEPARTMENTS_CO.map((dept) => (
                  <option key={dept} value={dept} className="bg-zinc-900">
                    {dept}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Código postal (opcional)"
                value={customer.postalCode}
                onChange={handleChange("postalCode")}
                className={`flex-1 ${INPUT_CLASS}`}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-zinc-400">Método de pago</p>
              <div className="grid grid-cols-2 gap-3">
                {PAYMENT_METHODS.map((method) => {
                  const isSelected = paymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id)}
                      className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? "border-accent bg-accent/15 text-white shadow-[0_0_0_1px_rgba(168,85,247,0.6),0_0_20px_rgba(168,85,247,0.25)]"
                          : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20"
                      }`}
                    >
                      <span className="block text-sm font-medium">{method.label}</span>
                      <span className="block text-xs text-zinc-500">{method.detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {paymentMethod === "cod" && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Anticipo a pagar ahora</span>
                  <span className="font-semibold text-accent-soft">
                    {formatCOP(COD_DEPOSIT_COP)}
                  </span>
                </div>
                <p className="mb-2 text-xs text-zinc-500">Cubre costos de producción</p>
                <div className="flex items-center justify-between border-t border-white/10 pt-2">
                  <span className="text-zinc-400">Saldo al recibir tu cuadro</span>
                  <span className="font-semibold text-white">
                    {formatCOP(order.priceCOP - COD_DEPOSIT_COP)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Sin costo adicional por pagar contraentrega.
                </p>
              </div>
            )}

            {/* En móvil el resumen + botón de pago de arriba queda fuera de
                vista al llenar un formulario largo. Repetimos solo el botón
                (mismas condiciones y mismo handler) al final del formulario;
                en desktop ambas columnas ya están lado a lado, así que ahí
                no hace falta. */}
            {payError && (
              <p className="text-sm text-red-400 sm:hidden">{payError}</p>
            )}
            {paymentMethod === "cod" ? (
              <div className="sm:hidden">
                <button
                  type="button"
                  disabled={isCodDisabled}
                  onClick={handlePayCod}
                  className={`${PAY_BUTTON_CLASS} ${
                    isCodDisabled ? "" : "animate-pay-breathe"
                  }`}
                >
                  {isConfirmingCod
                    ? "Procesando..."
                    : isWidgetReady
                    ? "Pagar al recibir"
                    : "Cargando pasarela..."}
                </button>
                <p className="mt-1.5 text-center text-xs text-zinc-500">
                  Anticipo de {formatCOP(COD_DEPOSIT_COP)} + excedente al recibir
                </p>
              </div>
            ) : (
              <div className="sm:hidden">
                <button
                  type="button"
                  disabled={isWompiDisabled}
                  onClick={handlePay}
                  className={`${PAY_BUTTON_CLASS} ${
                    isWompiDisabled ? "" : "animate-pay-breathe"
                  }`}
                >
                  {isPaying
                    ? "Procesando..."
                    : isWidgetReady
                    ? "Pagar ahora"
                    : "Cargando pasarela..."}
                </button>
                <p className="mt-1.5 text-center text-xs text-zinc-500">
                  Tarjeta / PSE con Wompi
                </p>
              </div>
            )}
          </div>

          <div className="order-1 flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 shadow-[0_0_40px_-14px_rgba(168,85,247,0.3)] sm:gap-4 sm:p-6 lg:order-2 lg:w-72">
            {/* Móvil: tarjeta compacta y colapsable — solo lo esencial visible,
                se expande al tocarla para no obligar a tanto scroll antes de
                llegar al formulario. */}
            <details className="group sm:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <img
                  src={order.croppedImage}
                  alt="Preview del cuadro"
                  className="h-12 w-12 shrink-0 rounded-lg border border-white/10 object-cover"
                />
                <div className="flex flex-1 items-center justify-between gap-2">
                  <span className="text-sm text-zinc-300">{order.sizeLabel}</span>
                  <span className="text-sm font-semibold">
                    {formatCOP(order.priceCOP)}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-zinc-500 transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <img
                src={order.croppedImage}
                alt="Preview del cuadro"
                className="mt-3 w-full rounded-lg border border-white/10 object-cover"
              />
            </details>

            {/* sm y superior: tarjeta de producto premium — miniatura grande
                con sombra propia, tamaño y precio destacado, para que se
                sienta como confirmar un producto terminado. */}
            <div className="hidden flex-col gap-4 sm:flex">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-zinc-300">Tu pedido</h2>
                <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent-soft">
                  Listo para producción
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/10 shadow-lg shadow-black/40">
                <img
                  src={order.croppedImage}
                  alt="Preview del cuadro"
                  className="w-full object-cover"
                />
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                <span className="text-zinc-400">Tamaño</span>
                <span className="font-medium">{order.sizeLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Total</span>
                <span className="text-2xl font-bold text-accent-soft">
                  {formatCOP(order.priceCOP)}
                </span>
              </div>
            </div>

            <FreeShippingBanner />

            {payError && (
              <p className="text-sm text-red-400">{payError}</p>
            )}

            {paymentMethod === "cod" ? (
              <button
                type="button"
                disabled={isCodDisabled}
                onClick={handlePayCod}
                className={`${PAY_BUTTON_CLASS} sm:mt-2 sm:py-3 ${
                  isCodDisabled ? "" : "animate-pay-breathe"
                }`}
              >
                {isConfirmingCod
                  ? "Procesando..."
                  : isWidgetReady
                  ? "Pagar al recibir"
                  : "Cargando pasarela..."}
              </button>
            ) : (
              <button
                type="button"
                disabled={isWompiDisabled}
                onClick={handlePay}
                className={`${PAY_BUTTON_CLASS} sm:mt-2 sm:py-3 ${
                  isWompiDisabled ? "" : "animate-pay-breathe"
                }`}
              >
                {isPaying
                  ? "Procesando..."
                  : isWidgetReady
                  ? "Pagar ahora"
                  : "Cargando pasarela..."}
              </button>
            )}
            <p className="text-center text-xs text-zinc-500">
              {paymentMethod === "cod"
                ? `Anticipo de ${formatCOP(COD_DEPOSIT_COP)} + excedente al recibir · Tarjeta / PSE con Wompi. Sin costo adicional por pagar contraentrega.`
                : "Tarjeta / PSE con Wompi — sandbox de pruebas, no se realizan cobros reales."}
            </p>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
