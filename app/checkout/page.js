"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { formatCOP, loadOrder, saveOrder } from "../lib/order";

const WOMPI_PUBLIC_KEY = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;

const emptyCustomer = {
  fullName: "",
  email: "",
  phonePrefix: "+57",
  phone: "",
  street: "",
  city: "",
  department: "",
};

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

export default function CheckoutPage() {
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [isWidgetReady, setIsWidgetReady] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState("");
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
      <div className="flex flex-1 items-center justify-center px-6 py-16">
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
    customer.city.trim() &&
    customer.department.trim();

  const handleChange = (field) => (e) =>
    setCustomer((prev) => ({ ...prev, [field]: e.target.value }));

  const handlePay = async () => {
    if (!isFormValid || !isWidgetReady || !window.WidgetCheckout) return;
    setPayError("");
    setIsPaying(true);

    const fullOrder = { ...order, customer };
    await saveOrder(fullOrder);

    const reference = `mystery-${Date.now()}`;
    const amountInCents = order.priceCOP * 100;
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

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Finaliza tu pedido
          </h1>
          <p className="mt-2 text-zinc-400">
            Completa tus datos de envío y paga con Wompi (modo prueba).
          </p>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex flex-1 flex-col gap-4">
            <h2 className="text-sm font-medium text-zinc-300">Tus datos</h2>

            <input
              type="text"
              placeholder="Nombre completo"
              value={customer.fullName}
              onChange={handleChange("fullName")}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <input
              type="email"
              placeholder="Correo electrónico"
              value={customer.email}
              onChange={handleChange("email")}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <div className="flex gap-3">
              <select
                value={customer.phonePrefix}
                onChange={handleChange("phonePrefix")}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-accent"
              >
                {PHONE_PREFIXES.map((p) => (
                  <option key={p.code} value={p.code} className="bg-zinc-900">
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                placeholder="Teléfono"
                value={customer.phone}
                onChange={handleChange("phone")}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-accent"
              />
            </div>

            <h2 className="mt-2 text-sm font-medium text-zinc-300">
              Dirección de envío
            </h2>
            <input
              type="text"
              placeholder="Calle y número"
              value={customer.street}
              onChange={handleChange("street")}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Ciudad"
                value={customer.city}
                onChange={handleChange("city")}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-accent"
              />
              <input
                type="text"
                placeholder="Departamento"
                value={customer.department}
                onChange={handleChange("department")}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="flex w-full flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-6 lg:w-72">
            <h2 className="text-sm font-medium text-zinc-300">Tu pedido</h2>

            <img
              src={order.croppedImage}
              alt="Preview del cuadro"
              className="w-full rounded-md border border-white/10 object-cover"
            />

            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Tamaño</span>
              <span>{order.sizeLabel}</span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatCOP(order.priceCOP)}</span>
            </div>

            {payError && (
              <p className="text-sm text-red-400">{payError}</p>
            )}

            <button
              type="button"
              disabled={!isFormValid || !isWidgetReady || isPaying}
              onClick={handlePay}
              className="mt-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPaying
                ? "Procesando..."
                : isWidgetReady
                ? "Pagar con Wompi"
                : "Cargando pasarela..."}
            </button>
            <p className="text-center text-xs text-zinc-500">
              Sandbox de pruebas — no se realizan cobros reales.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
