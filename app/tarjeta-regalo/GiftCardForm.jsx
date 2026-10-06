"use client";

import { useState } from "react";
import { GIFT_MESSAGE_MAX, GIFT_NAME_MAX } from "../lib/giftFeatures";

const INPUT =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-[#1b2a4a] placeholder:text-[#8a97b3] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

// Pide datos mínimos y manda al cliente al Web Checkout de Wompi (GET a
// checkout.wompi.co/p/ con la firma de integridad que calculó el
// servidor). El pago SIEMPRE es en la web — sin WhatsApp.
export default function GiftCardForm() {
  const [form, setForm] = useState({ buyerName: "", buyerEmail: "", recipientName: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/gift-card/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar el pago.");

      const fields = {
        "public-key": data.publicKey,
        currency: data.currency,
        "amount-in-cents": String(data.amountInCents),
        reference: data.reference,
        "signature:integrity": data.signature,
        "redirect-url": data.redirectUrl,
        "customer-data:email": form.buyerEmail.trim(),
        "customer-data:full-name": form.buyerName.trim(),
      };
      const f = document.createElement("form");
      f.method = "GET";
      f.action = "https://checkout.wompi.co/p/";
      for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        f.appendChild(input);
      }
      document.body.appendChild(f);
      f.submit();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-black/5 bg-[#fffaf0] px-5 py-6 shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)]"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gc-buyer" className="text-sm font-medium text-[#33456b]">Tu nombre</label>
        <input id="gc-buyer" required maxLength={GIFT_NAME_MAX} value={form.buyerName} onChange={set("buyerName")} className={INPUT} autoComplete="name" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gc-email" className="text-sm font-medium text-[#33456b]">Tu correo (ahí te llega la tarjeta)</label>
        <input id="gc-email" type="email" required maxLength={254} value={form.buyerEmail} onChange={set("buyerEmail")} className={INPUT} autoComplete="email" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gc-recipient" className="text-sm font-medium text-[#33456b]">¿Para quién es? (opcional)</label>
        <input id="gc-recipient" maxLength={GIFT_NAME_MAX} value={form.recipientName} onChange={set("recipientName")} className={INPUT} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gc-message" className="text-sm font-medium text-[#33456b]">Mensaje (opcional)</label>
        <textarea id="gc-message" rows={3} maxLength={GIFT_MESSAGE_MAX} value={form.message} onChange={set("message")} className={INPUT} placeholder="¡Feliz Navidad! Elige tu foto favorita…" />
        <span className="self-end text-xs text-[#5b6b8c]">{form.message.length}/{GIFT_MESSAGE_MAX}</span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-soft disabled:opacity-40"
      >
        {busy ? "Abriendo pago seguro…" : "Pagar con Wompi"}
      </button>
      <p className="text-center text-xs text-[#5b6b8c]">Tarjeta, PSE, Nequi o Daviplata. Un solo uso, para un cuadro 40x50.</p>
    </form>
  );
}
