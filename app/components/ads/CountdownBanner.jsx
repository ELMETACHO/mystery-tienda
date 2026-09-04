"use client";

import { useEffect, useState } from "react";

const DURATION_SECONDS = 60 * 60; // 1 hora
const STORAGE_KEY = "mystery-ads-countdown-end";

// Cuenta regresiva "de urgencia" — NO es un deadline real ni compartido
// entre visitantes (no hay oferta con fecha límite real detrás). Se
// persiste en sessionStorage como un timestamp de fin (no un contador
// crudo) para que siga bajando desde donde iba aunque el cliente recargue
// la página, en vez de reiniciarse a 60:00 cada vez — solo se reinicia
// cuando de verdad llega a 00:00.
function readEndTime() {
  if (typeof window === "undefined") return Date.now() + DURATION_SECONDS * 1000;

  const stored = Number(window.sessionStorage.getItem(STORAGE_KEY));
  if (stored && stored > Date.now()) return stored;

  const endTime = Date.now() + DURATION_SECONDS * 1000;
  window.sessionStorage.setItem(STORAGE_KEY, String(endTime));
  return endTime;
}

export default function CountdownBanner() {
  const [secondsLeft, setSecondsLeft] = useState(DURATION_SECONDS);

  useEffect(() => {
    let endTime = readEndTime();

    const tick = () => {
      const remaining = Math.round((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        endTime = Date.now() + DURATION_SECONDS * 1000;
        window.sessionStorage.setItem(STORAGE_KEY, String(endTime));
        setSecondsLeft(DURATION_SECONDS);
        return;
      }
      setSecondsLeft(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="mx-auto max-w-md rounded-xl border border-orange-500/40 bg-orange-100 px-4 py-2.5 text-center">
      <p className="text-sm font-semibold text-orange-700">
        ⏰ ¡Date prisa! La oferta termina en {minutes}:{seconds}
      </p>
    </div>
  );
}
