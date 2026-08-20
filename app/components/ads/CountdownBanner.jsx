"use client";

import { useEffect, useState } from "react";

const DURATION_SECONDS = 60 * 60; // 1 hora

// Cuenta regresiva "de urgencia" — NO es un deadline real ni compartido
// entre visitantes (no hay oferta con fecha límite real detrás). Cada
// visita nueva reinicia el contador en 1 hora, por sesión — práctica
// común en landings de este tipo, explícitamente pedida así (no hace
// falta persistirlo en sessionStorage entre recargas).
export default function CountdownBanner() {
  const [secondsLeft, setSecondsLeft] = useState(DURATION_SECONDS);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="mx-auto max-w-md rounded-xl border border-orange-500/40 bg-orange-500/15 px-4 py-2.5 text-center">
      <p className="text-sm font-semibold text-orange-300">
        ⏰ ¡Date prisa! La oferta termina en {minutes}:{seconds}
      </p>
    </div>
  );
}
