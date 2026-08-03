"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadOrder } from "../../lib/order";

export default function ConfirmacionPage() {
  const [reference, setReference] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const order = await loadOrder();
      if (!cancelled) setReference(order?.payment?.reference ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-12 text-center sm:px-6 sm:py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-2xl sm:h-16 sm:w-16 sm:text-3xl">
        ✓
      </div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        ¡Pago exitoso!
      </h1>
      <p className="text-base text-zinc-400 sm:text-lg">
        Tu pedido está en camino.
      </p>
      {reference && (
        <p className="break-all text-xs text-zinc-500">
          Referencia: {reference}
        </p>
      )}
      <Link
        href="/"
        className="mt-4 w-full max-w-xs rounded-full border border-white/15 px-6 py-3 text-sm text-zinc-300 transition-colors hover:border-white/30 sm:w-auto sm:py-2.5"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
