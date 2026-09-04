"use client";

import { useEffect, useRef, useState } from "react";

// Ventas REALES confirmadas antes del reset de la base de datos (Redis se
// reinició, así que completed-orders ya no tiene ese historial en vivo).
// Lista fija con pedidos reales ya entregados — nunca se inventan ventas
// ficticias. Si algún día se vuelve a tener historial real en Redis, esta
// lista es el lugar a reemplazar por una consulta en vivo.
const REAL_SALES = [
  { name: "Angélica M.", size: "30x40 cm" },
  { name: "Gloria S.", size: "40x50 cm" },
  { name: "Oscar D.", size: "40x50 cm" },
  { name: "Jesús H.", size: "40x50 cm" },
  { name: "Hernán B.", size: "30x40 cm" },
  { name: "Isabella M.", size: "40x50 cm" },
  { name: "Tatiana D.", size: "40x50 cm" },
];

function shuffled(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const SHOW_MS = 2800;
const GAP_MIN_MS = 9000;
const GAP_MAX_MS = 16000;

// Aviso discreto en una esquina: "Fulano compró un cuadro 40x50 cm",
// aparece 2-3s cada cierto tiempo y desaparece con una transición suave.
// El orden se reproduce aleatorio (se re-baraja) en cada carga de página.
export default function RecentPurchaseToast() {
  const [entry, setEntry] = useState(null);
  const [visible, setVisible] = useState(false);
  const queueRef = useRef([]);

  useEffect(() => {
    if (REAL_SALES.length === 0) return undefined;

    queueRef.current = shuffled(REAL_SALES);
    let cancelled = false;
    let timeoutId;

    const showNext = () => {
      if (cancelled) return;
      if (queueRef.current.length === 0) {
        queueRef.current = shuffled(REAL_SALES);
      }
      setEntry(queueRef.current.shift());
      setVisible(true);

      timeoutId = setTimeout(() => {
        if (cancelled) return;
        setVisible(false);
        const gap = GAP_MIN_MS + Math.random() * (GAP_MAX_MS - GAP_MIN_MS);
        timeoutId = setTimeout(showNext, gap);
      }, SHOW_MS);
    };

    const initialDelay = 3000 + Math.random() * 2000;
    timeoutId = setTimeout(showNext, initialDelay);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  if (!entry) return null;

  return (
    <div
      className={`fixed bottom-24 left-3 z-40 max-w-[13rem] rounded-xl border border-black/10 bg-white/90 px-3 py-2 shadow-lg backdrop-blur transition-all duration-500 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
      aria-live="polite"
    >
      <p className="text-[11px] leading-tight text-[#33456b]">
        <span aria-hidden="true">🛒</span>{" "}
        <span className="font-semibold text-[#1b2a4a]">{entry.name}</span> compró un cuadro{" "}
        <span className="text-accent">{entry.size}</span>
      </p>
    </div>
  );
}
