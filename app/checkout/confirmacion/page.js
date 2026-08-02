"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadOrder } from "../../lib/order";

export default function ConfirmacionPage() {
  const [reference, setReference] = useState(null);

  useEffect(() => {
    const order = loadOrder();
    setReference(order?.payment?.reference ?? null);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-3xl">
        ✓
      </div>
      <h1 className="text-3xl font-bold tracking-tight">¡Pago exitoso!</h1>
      <p className="text-lg text-zinc-400">Tu pedido está en camino.</p>
      {reference && (
        <p className="text-xs text-zinc-500">Referencia: {reference}</p>
      )}
      <Link
        href="/"
        className="mt-4 rounded-full border border-white/15 px-6 py-2.5 text-sm text-zinc-300 transition-colors hover:border-white/30"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
