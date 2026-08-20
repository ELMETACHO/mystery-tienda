"use client";

import { useEffect, useState } from "react";

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// No hay tráfico en vivo real para medir esto — número pseudo-aleatorio
// creíble (20-100) que varía ligeramente cada pocos segundos, nunca un
// conteo real. Igual que el countdown, es prueba social de "urgencia",
// no un dato verificable.
export default function ViewersCounter() {
  const [viewers, setViewers] = useState(null);

  useEffect(() => {
    setViewers(randomBetween(20, 100));
    const interval = setInterval(() => {
      setViewers((prev) => {
        const next = (prev ?? 40) + randomBetween(-4, 4);
        return Math.min(100, Math.max(20, next));
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <p className="flex items-center justify-center gap-1.5 text-xs text-zinc-400">
      <span aria-hidden="true">👁️</span>
      {viewers === null ? (
        <span>Cargando visitas...</span>
      ) : (
        <span>
          <span className="font-semibold text-zinc-200">{viewers}</span> personas viendo ahora mismo
        </span>
      )}
    </p>
  );
}
