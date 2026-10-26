"use client";

import { useState } from "react";

// "Muéstrale tu cuadro a alguien" (oct 2026): mucha gente compra para
// regalar o consulta con la pareja/familia antes de pagar — antes tenían
// que tomar pantallazo. Abre el "Compartir" nativo del celular con la
// imagen del cuadro en la pared + el link de la tienda; el cliente elige a
// dónde mandarlo (nada se envía solo, nada de WhatsApp automático).
//
// Cero costo hasta que lo tocan: la composición (sharePreviewImage.js) se
// descarga y se dibuja recién al tocar, a partir del mockup que la página
// ya tiene en pantalla (sin peticiones nuevas al servidor). Si algo falla
// o el cliente cancela, no pasa nada: el botón vuelve a su estado normal.
export default function SharePreviewButton({ targetRef, className = "" }) {
  const [busy, setBusy] = useState(false);

  const handleShare = async () => {
    if (busy || !targetRef?.current) return;
    setBusy(true);
    try {
      const { shareReadyPreview } = await import("./sharePreviewImage");
      const method = await shareReadyPreview(targetRef.current);
      if (method && typeof window !== "undefined") {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: "preview_shared", share_method: method });
      }
    } catch (err) {
      // AbortError = el cliente cerró el menú de compartir; no es un error.
      if (err?.name !== "AbortError") console.error("[compartir] No se pudo compartir:", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={busy}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-accent/50 bg-white/70 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-60 ${className}`}
    >
      {busy ? "Preparando imagen…" : "📤 Muéstrale tu cuadro a alguien"}
    </button>
  );
}
