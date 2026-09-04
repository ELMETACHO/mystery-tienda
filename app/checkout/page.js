"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { COD_DEPOSIT_COP, formatCOP, loadOrder, saveOrder } from "../lib/order";
import { lookupPostalCode } from "../lib/postalCodes";
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
  "rounded-xl border border-black/10 bg-[#fffaf0] px-4 py-3.5 text-base outline-none transition-colors duration-200 focus:border-accent focus:ring-1 focus:ring-accent/30 sm:py-3 sm:text-sm";

// Botones de pago: el color/gradiente/sombra intensos y la respiración
// sutil (ver .animate-pay-breathe en globals.css) buscan que sea el
// elemento que más llama la atención de la pantalla — es la acción
// principal que el cliente debe tomar.
const PAY_BUTTON_CLASS =
  "mt-1 w-full rounded-full bg-gradient-to-r from-fuchsia-500 via-accent to-purple-700 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/50 transition-all duration-200 hover:shadow-[0_0_36px_rgba(168,85,247,0.85)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:animate-none";

function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [isWidgetReady, setIsWidgetReady] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("wompi"); // "wompi" | "cod"
  const [isConfirmingCod, setIsConfirmingCod] = useState(false);
  const widgetRef = useRef(null);

  // Código de descuento MYSTERY10 o de referido — mismo campo, mismo
  // efecto sobre el precio (ambos dan descuento al comprador, ver
  // /api/validate-discount): la única diferencia es qué campo del
  // pedido se llena al pagar (discountCode vs referralCode, ver
  // handlePay/handlePayCod) — type distingue cuál de los dos fue.
  // Link discreto en vez de un campo siempre visible, para no saturar a
  // quien no tiene código (ver CLAUDE.md: la mayoría de clientes son
  // nuevos).
  const [showDiscountField, setShowDiscountField] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [appliedCode, setAppliedCode] = useState(null); // { type: "discount"|"referral", code, percent, discountedPriceCOP }
  const [discountError, setDiscountError] = useState("");
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Link de recuperación de carrito abandonado (ver
      // /api/cron/send-cart-recovery-emails y email.js): trae order y
      // customer directo de Redis por reference/token en vez de
      // IndexedDB, así funciona aunque el cliente abra el correo en
      // otro dispositivo o navegador distinto al que usó para /crear.
      const resumeReference = searchParams.get("resume");
      const resumeToken = searchParams.get("token");

      if (resumeReference && resumeToken) {
        try {
          const res = await fetch(
            `/api/resume-pending-order?reference=${encodeURIComponent(resumeReference)}&token=${encodeURIComponent(resumeToken)}`
          );
          if (cancelled) return;

          if (res.ok) {
            const { order: resumedOrder, customer: resumedCustomer } = await res.json();
            if (resumedOrder?.croppedImage) {
              // Se guarda también en IndexedDB para que el resto del
              // flujo (recargar la página, volver de Wompi, etc.) siga
              // funcionando exactamente igual que con un pedido normal.
              await saveOrder(resumedOrder);
              setOrder(resumedOrder);
              if (resumedCustomer) {
                setCustomer((prev) => ({ ...prev, ...resumedCustomer }));
              }
              setIsLoadingOrder(false);
              return;
            }
          } else {
            console.error(
              "[checkout] No se pudo retomar el pedido pendiente:",
              await res.text().catch(() => res.status)
            );
          }
        } catch (err) {
          console.error("[checkout] Error retomando pedido pendiente:", err);
        }
        // Si el link de recuperación falló por lo que sea (vencido,
        // token inválido, error de red), sigue el flujo normal abajo en
        // vez de dejar al cliente atascado en "Cargando tu pedido...".
      }

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
  }, [router, searchParams]);

  // Código postal derivado automáticamente de departamento + ciudad contra
  // el catálogo canónico de Skydropx (ver app/lib/postalCodes.js) — antes
  // el cliente lo escribía a mano, lo que era una fuente frecuente de
  // errores de cotización. Si no hay match en el catálogo, se deja vacío
  // (nunca bloquea el pedido, ver lookupPostalCode).
  //
  // IMPORTANTE: este hook debe quedar SIEMPRE antes del early return de
  // abajo (isLoadingOrder/!order) — todos los hooks de un componente deben
  // ejecutarse en el mismo orden en cada render. Tenerlo después del
  // return causaba React error #310 ("Rendered fewer hooks than expected"):
  // en el primer render (isLoadingOrder=true) el componente retornaba antes
  // de llegar a este useEffect, pero en renders posteriores (ya con la
  // orden cargada) sí lo alcanzaba — un número distinto de hooks entre
  // renders, lo que React nunca permite.
  useEffect(() => {
    const found = lookupPostalCode(customer.department, customer.city);
    setCustomer((prev) =>
      prev.postalCode === (found || "") ? prev : { ...prev, postalCode: found || "" }
    );
  }, [customer.department, customer.city]);

  if (isLoadingOrder || !order) {
    return (
      <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-[#8fcaf0] px-4 py-16 sm:px-6">
        <div
          aria-hidden="true"
          className="fixed inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/images/walls/fondo-cielo-2.webp)" }}
        />
        <p className="relative z-10 text-[#33456b]">Cargando tu pedido...</p>
      </div>
    );
  }

  const effectivePriceCOP = appliedCode ? appliedCode.discountedPriceCOP : order.priceCOP;

  const handleApplyDiscount = async () => {
    const code = discountInput.trim().toUpperCase();
    if (!code) return;

    if (!customer.email.trim()) {
      setAppliedCode(null);
      setDiscountError("Ingresa tu correo arriba antes de aplicar el código.");
      return;
    }

    setIsValidatingDiscount(true);
    setDiscountError("");
    try {
      const res = await fetch("/api/validate-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: customer.email, code }),
      });
      const data = await res.json();

      if (data.valid && (data.type === "discount" || data.type === "referral")) {
        const discountedPriceCOP = Math.round(order.priceCOP * (1 - data.percent / 100));
        setAppliedCode({
          type: data.type,
          code: data.code || code,
          percent: data.percent,
          discountedPriceCOP,
        });
        setDiscountError("");
      } else {
        setAppliedCode(null);
        setDiscountError(data.error || "Código inválido o ya utilizado");
      }
    } catch (err) {
      console.error(err);
      setAppliedCode(null);
      setDiscountError("No pudimos validar el código. Intenta de nuevo.");
    } finally {
      setIsValidatingDiscount(false);
    }
  };

  // Exactamente 10 dígitos numéricos, sin espacios ni caracteres
  // especiales — mismo formato que exige Skydropx al crear la guía
  // (ver normalizePhone en app/lib/skydropx.js). Validar acá evita que
  // un pedido real llegue con un teléfono incompleto y solo se
  // descubra días después, al generar la guía manual.
  const isPhoneValid = /^\d{10}$/.test(customer.phone);

  const isFormValid =
    customer.fullName.trim() &&
    customer.email.trim() &&
    customer.phonePrefix.trim() &&
    isPhoneValid &&
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

  // Filtra en vivo cualquier caracter que no sea dígito (espacios,
  // guiones, +, letras) — así el campo nunca contiene "sin espacios ni
  // caracteres especiales" por construcción, sin depender solo del
  // mensaje de error para corregirlo.
  const handlePhoneChange = (e) =>
    setCustomer((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, "") }));

  const setHousingType = (housingType) =>
    setCustomer((prev) => ({ ...prev, housingType }));

  const handlePay = async () => {
    if (!isFormValid || !isWidgetReady || !window.WidgetCheckout) return;
    setPayError("");
    setIsPaying(true);

    const fullOrder = {
      ...order,
      customer,
      // Precio efectivo (con MYSTERY10 aplicado si corresponde) — se
      // propaga desde aquí a Wompi (amountInCents abajo), Skydropx
      // (declared_value lee order.priceCOP) y los correos de
      // confirmación, todos con una sola fuente de verdad.
      priceCOP: effectivePriceCOP,
      discountCode: appliedCode?.type === "discount" ? appliedCode.code : null,
      referralCode: appliedCode?.type === "referral" ? appliedCode.code : null,
    };
    await saveOrder(fullOrder);

    const reference = `mystery-${Date.now()}`;
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

    // El monto NUNCA se calcula en el navegador para el pago real: se le
    // manda al servidor solo lo necesario para que él mismo recalcule el
    // precio (tamaño + código de descuento/referido) y devuelva el
    // amountInCents correcto junto con la firma — ver
    // app/api/wompi-signature/route.js. El widget de Wompi se abre con
    // ESE valor devuelto, nunca con uno calculado acá.
    let signature;
    let amountInCents;
    try {
      const res = await fetch("/api/wompi-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference,
          currency,
          sizeId: fullOrder.sizeId,
          frameType: fullOrder.frameType,
          discountCode: fullOrder.discountCode,
          referralCode: fullOrder.referralCode,
          customerEmail: customer.email,
        }),
      });
      if (!res.ok) throw new Error("No se pudo generar la firma");
      ({ signature, amountInCents } = await res.json());
    } catch (err) {
      console.error(err);
      setPayError("No se pudo iniciar el pago. Intenta de nuevo.");
      setIsPaying(false);
      return;
    }

    // Wompi rechaza con 403 (silencioso: pasa DENTRO de su iframe, nunca
    // llega a nuestro try/catch) cualquier redirect-url que no sea un
    // dominio autorizado para esta llave — localhost nunca lo está. Sin
    // este chequeo, CUALQUIER pago completo en local se queda colgado en
    // "Procesando..." para siempre, sin importar si hay código de
    // descuento/referido o no (así se reprodujo este bug: no tenía nada
    // que ver con el código, solo coincidió con la primera prueba local
    // después de agregar redirectUrl).
    const isLocalDev =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

    widgetRef.current = new window.WidgetCheckout({
      currency,
      amountInCents,
      reference,
      publicKey: WOMPI_PUBLIC_KEY,
      signature: { integrity: signature },
      // Si Wompi redirige el navegador automáticamente en vez de invocar
      // el callback de abajo (pasa en algunos navegadores/flujos donde el
      // cliente nunca hace clic en "Volver a comercio"), aterriza en
      // /checkout/confirmacion con ?id=<transactionId> en la URL — esa
      // página detecta el parámetro y llama a /api/confirm-order por su
      // cuenta. Seguro llamarlo por los dos caminos: confirmApprovedOrder
      // ya es idempotente (claimTransaction), igual que con el webhook.
      // Solo se manda en dominios reales (nunca localhost) — ver nota de
      // arriba.
      ...(isLocalDev
        ? {}
        : { redirectUrl: `${window.location.origin}/checkout/confirmacion` }),
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

    const fullOrder = {
      ...order,
      customer,
      // El anticipo (COD_DEPOSIT_COP) es un monto fijo, no cambia con el
      // descuento — pero el precio total sí, y de ahí se calcula el
      // saldo pendiente en /api/confirm-cod-order (order.priceCOP -
      // COD_DEPOSIT_COP), así que igual necesita quedar ya descontado.
      priceCOP: effectivePriceCOP,
      discountCode: appliedCode?.type === "discount" ? appliedCode.code : null,
      referralCode: appliedCode?.type === "referral" ? appliedCode.code : null,
    };
    await saveOrder(fullOrder);

    const reference = `mystery-cod-${Date.now()}`;
    const currency = "COP";

    // Mismo patrón que handlePay: guardado en Redis por `reference` ANTES
    // de pagar — red de seguridad para que /api/wompi-webhook pueda
    // confirmar el anticipo aunque el cliente nunca regrese a esta
    // pestaña (antes, este flujo contraentrega no tenía NINGÚN respaldo
    // de webhook — si /api/confirm-cod-order fallaba en el navegador, el
    // pedido se perdía por completo pese al cobro real). paymentMethod:
    // "cod" le indica al webhook que confirme como anticipo, no como
    // pago completo. No es fatal si falla: el camino normal no depende
    // de esto.
    fetch("/api/save-pending-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, order: fullOrder, customer, paymentMethod: "cod" }),
    }).catch((err) => {
      console.error("[checkout] No se pudo guardar el pedido pendiente (contraentrega):", err);
    });

    // Mismo criterio que handlePay: el servidor decide el monto (acá
    // siempre COD_DEPOSIT_COP, ver isCod en app/api/wompi-signature) y lo
    // devuelve junto con la firma — nunca se abre el widget con un monto
    // calculado en el navegador.
    let signature;
    let amountInCents;
    try {
      const res = await fetch("/api/wompi-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, currency, isCod: true }),
      });
      if (!res.ok) throw new Error("No se pudo generar la firma");
      ({ signature, amountInCents } = await res.json());
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

  // Se renderiza dos veces: en la tarjeta de resumen (arriba del botón
  // de pago principal) y de nuevo justo encima del botón de pago
  // duplicado al final del formulario en móvil — antes solo estaba en
  // la primera, así que quien llenaba el formulario largo y pagaba
  // desde el botón de abajo nunca veía la opción de aplicar un código.
  const discountCodeSection = (
    <div className="border-t border-black/10 pt-3">
      {appliedCode ? (
        <p className="text-xs text-emerald-700">
          🎉 Código {appliedCode.code} aplicado — descuento del{" "}
          {appliedCode.percent}%
        </p>
      ) : showDiscountField ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Código de descuento"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              className={`flex-1 ${INPUT_CLASS} py-2 text-sm`}
            />
            <button
              type="button"
              onClick={handleApplyDiscount}
              disabled={isValidatingDiscount || !discountInput.trim()}
              className="shrink-0 rounded-xl border border-accent/50 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isValidatingDiscount ? "Validando..." : "Aplicar"}
            </button>
          </div>
          {discountError && <p className="text-xs text-red-600">{discountError}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowDiscountField(true)}
          className="text-sm font-medium text-accent underline decoration-accent/50 underline-offset-4 transition-colors hover:text-[#1b2a4a]"
        >
          CÓDIGO DE DESCUENTO
        </button>
      )}
    </div>
  );

  return (
    <>
      <Script
        src="https://checkout.wompi.co/widget.js"
        strategy="afterInteractive"
        onReady={() => setIsWidgetReady(true)}
      />

      <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[#8fcaf0] text-[#1b2a4a]">
        <div
          aria-hidden="true"
          className="fixed inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/images/walls/fondo-cielo-2.webp)" }}
        />

        <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col gap-3 px-4 py-4 sm:gap-10 sm:px-6 sm:py-16">
        <div className="text-center">
          <h1 className="font-brand text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            Finaliza tu pedido
          </h1>
          <p className="mt-1 text-sm text-[#33456b] sm:mt-2 sm:text-base">
            Completa tus datos de envío.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:gap-8 lg:flex-row">
          <div className="order-2 flex flex-1 flex-col gap-3 sm:gap-4 lg:order-1">
            <h2 className="text-sm font-medium text-[#33456b]">Tus datos</h2>

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
                  <option key={p.code} value={p.code} className="bg-white text-[#1b2a4a]">
                    {p.label}
                  </option>
                ))}
              </select>
              <div className="flex-1">
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="Celular (10 dígitos)"
                  maxLength={10}
                  value={customer.phone}
                  onChange={handlePhoneChange}
                  className={`w-full ${INPUT_CLASS}`}
                />
                {customer.phone.length > 0 && !isPhoneValid && (
                  <p className="mt-1.5 text-xs text-red-600">
                    El celular debe tener exactamente 10 dígitos numéricos (tienes{" "}
                    {customer.phone.length}).
                  </p>
                )}
              </div>
            </div>

            <h2 className="mt-2 text-sm font-medium text-[#33456b]">
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
              <p className="mb-2 text-xs font-medium text-[#33456b]">
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
                          ? "border-accent bg-accent/15 text-[#1b2a4a] shadow-[0_0_0_1px_rgba(168,85,247,0.6),0_0_20px_rgba(168,85,247,0.25)]"
                          : "border-black/10 bg-[#fffaf0] text-[#33456b] hover:border-black/20"
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
                  customer.department ? "" : "text-[#5b6b8c]"
                }`}
              >
                <option value="" disabled className="bg-white text-[#1b2a4a]">
                  Departamento
                </option>
                {DEPARTMENTS_CO.map((dept) => (
                  <option key={dept} value={dept} className="bg-white text-[#1b2a4a]">
                    {dept}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Código postal (automático)"
                value={customer.postalCode}
                readOnly
                title="Se calcula automáticamente según el departamento y la ciudad"
                className={`flex-1 ${INPUT_CLASS} cursor-not-allowed text-[#33456b]`}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-[#33456b]">Método de pago</p>
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
                          ? "border-accent bg-accent/15 text-[#1b2a4a] shadow-[0_0_0_1px_rgba(168,85,247,0.6),0_0_20px_rgba(168,85,247,0.25)]"
                          : "border-black/10 bg-[#fffaf0] text-[#33456b] hover:border-black/20"
                      }`}
                    >
                      <span className="block text-sm font-medium">{method.label}</span>
                      <span className="block text-xs text-[#5b6b8c]">{method.detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {paymentMethod === "cod" && (
              <div className="rounded-xl border border-black/10 bg-[#fffaf0] px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#33456b]">Anticipo a pagar ahora</span>
                  <span className="font-semibold text-accent">
                    {formatCOP(COD_DEPOSIT_COP)}
                  </span>
                </div>
                <p className="mb-2 text-xs text-[#5b6b8c]">Cubre costos de producción</p>
                <div className="flex items-center justify-between border-t border-black/10 pt-2">
                  <span className="text-[#33456b]">Saldo al recibir tu cuadro</span>
                  <span className="font-semibold text-[#1b2a4a]">
                    {formatCOP(effectivePriceCOP - COD_DEPOSIT_COP)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[#5b6b8c]">
                  Sin costo adicional por pagar contraentrega.
                </p>
              </div>
            )}

            {/* En móvil el resumen + botón de pago de arriba queda fuera de
                vista al llenar un formulario largo. Repetimos el botón
                (mismas condiciones y mismo handler) y el código de
                descuento al final del formulario; en desktop ambas
                columnas ya están lado a lado, así que ahí no hace falta. */}
            <div className="sm:hidden">{discountCodeSection}</div>
            {payError && (
              <p className="text-sm text-red-600 sm:hidden">{payError}</p>
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
                <p className="mt-1.5 text-center text-xs text-[#5b6b8c]">
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
                <p className="mt-1.5 text-center text-xs text-[#5b6b8c]">
                  Tarjeta / PSE con Wompi
                </p>
              </div>
            )}
          </div>

          <div className="order-1 flex w-full flex-col gap-3 rounded-2xl border border-black/10 bg-[#fffaf0] p-3 shadow-[0_0_40px_-14px_rgba(168,85,247,0.3)] sm:gap-4 sm:p-6 lg:order-2 lg:w-72">
            {/* Móvil: tarjeta compacta y colapsable — solo lo esencial visible,
                se expande al tocarla para no obligar a tanto scroll antes de
                llegar al formulario. */}
            <details className="group sm:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <img
                  src={order.croppedImage}
                  alt="Preview del cuadro"
                  className="h-12 w-12 shrink-0 rounded-lg border border-black/10 object-cover"
                />
                <div className="flex flex-1 items-center justify-between gap-2">
                  <span className="text-sm text-[#33456b]">{order.sizeLabel}</span>
                  <span className="flex items-baseline gap-1.5 text-sm font-semibold">
                    {appliedCode && (
                      <span className="text-xs font-normal text-[#5b6b8c] line-through">
                        {formatCOP(order.priceCOP)}
                      </span>
                    )}
                    {formatCOP(effectivePriceCOP)}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-[#5b6b8c] transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <img
                src={order.croppedImage}
                alt="Preview del cuadro"
                className="mt-3 w-full rounded-lg border border-black/10 object-cover"
              />
            </details>

            {/* sm y superior: tarjeta de producto premium — miniatura grande
                con sombra propia, tamaño y precio destacado, para que se
                sienta como confirmar un producto terminado. */}
            <div className="hidden flex-col gap-4 sm:flex">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-[#33456b]">Tu pedido</h2>
                <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent">
                  Listo para producción
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-black/10 shadow-lg shadow-black/40">
                <img
                  src={order.croppedImage}
                  alt="Preview del cuadro"
                  className="w-full object-cover"
                />
              </div>
              <div className="flex items-center justify-between border-t border-black/10 pt-3 text-sm">
                <span className="text-[#33456b]">Tamaño</span>
                <span className="font-medium">{order.sizeLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#33456b]">Total</span>
                <span className="flex items-baseline gap-2">
                  {appliedCode && (
                    <span className="text-sm font-normal text-[#5b6b8c] line-through">
                      {formatCOP(order.priceCOP)}
                    </span>
                  )}
                  <span className="text-2xl font-bold text-accent">
                    {formatCOP(effectivePriceCOP)}
                  </span>
                </span>
              </div>
            </div>

            {discountCodeSection}

            <FreeShippingBanner />

            {payError && (
              <p className="text-sm text-red-600">{payError}</p>
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
            <p className="text-center text-xs text-[#5b6b8c]">
              {paymentMethod === "cod"
                ? `Anticipo de ${formatCOP(COD_DEPOSIT_COP)} + excedente al recibir · Tarjeta / PSE con Wompi. Sin costo adicional por pagar contraentrega.`
                : "Tarjeta / PSE con Wompi — sandbox de pruebas, no se realizan cobros reales."}
            </p>
            <p className="text-center text-xs text-[#8a94ac]">
              Al pagar aceptas nuestras{" "}
              <Link href="/politicas" className="underline-offset-2 hover:text-[#33456b] hover:underline">
                políticas de privacidad y devolución
              </Link>
              .
            </p>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}

// useSearchParams (para el link de recuperación de carrito) exige un
// límite de Suspense alrededor de quien lo llama — sin esto, Next.js
// falla el build ("should be wrapped in a suspense boundary").
export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-[#8fcaf0] px-4 py-16 sm:px-6">
          <div
            aria-hidden="true"
            className="fixed inset-0 z-0 bg-cover bg-center"
            style={{ backgroundImage: "url(/images/walls/fondo-cielo-2.webp)" }}
          />
          <p className="relative z-10 text-[#33456b]">Cargando tu pedido...</p>
        </div>
      }
    >
      <CheckoutForm />
    </Suspense>
  );
}
