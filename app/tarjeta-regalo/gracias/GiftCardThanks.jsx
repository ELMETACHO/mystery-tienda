"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const MESSAGES = {
  checking: ["Verificando tu pago…", "Esto toma unos segundos."],
  ok: ["🎁 ¡Listo! Tu tarjeta regalo va en camino a tu correo", "Revisa también la carpeta de spam o promociones."],
  pending: ["Tu pago está en proceso", "Cuando Wompi lo apruebe te llega la tarjeta al correo (no tienes que hacer nada más)."],
  declined: ["El pago no fue aprobado", "No se hizo ningún cobro. Puedes intentarlo de nuevo."],
  error: ["No pudimos confirmar todavía", "Si el pago fue aprobado, la tarjeta te llegará al correo. Si no llega en 1 hora, escríbenos a pedidos@mysterycuadros.com."],
};

export default function GiftCardThanks() {
  const transactionId = useSearchParams().get("id");
  const [state, setState] = useState(transactionId ? "checking" : "error");

  useEffect(() => {
    if (!transactionId) return;
    let cancelled = false;
    let attempt = 0;
    const run = async () => {
      attempt += 1;
      try {
        const res = await fetch("/api/gift-card/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) return setState("ok");
        if (res.status === 402 && data.status === "PENDING" && attempt < 6) {
          setState("pending");
          return setTimeout(run, 5000);
        }
        if (res.status === 402) return setState(data.status === "PENDING" ? "pending" : "declined");
        setState("error");
      } catch {
        if (!cancelled) setState("error");
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  const [title, text] = MESSAGES[state];
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-black/5 bg-[#fffaf0] px-6 py-10 text-center shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)]">
      <p className="text-lg font-semibold text-[#1b2a4a]">{title}</p>
      <p className="text-sm text-[#5b6b8c]">{text}</p>
      {state === "declined" && (
        <a href="/tarjeta-regalo" className="mt-3 text-sm font-semibold text-accent underline underline-offset-4">
          Intentar de nuevo
        </a>
      )}
    </div>
  );
}
