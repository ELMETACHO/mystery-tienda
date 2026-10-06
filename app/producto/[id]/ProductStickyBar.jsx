"use client";

import { useEffect, useState } from "react";

// Barra fija de móvil (oct 2026): SOLO baja hasta el selector de tamaño
// (#elegir-tamano). No agrega al carrito, no abre el checkout ni toca el
// flujo de pago: el cliente elige tamaño y paga con los botones de
// siempre (ProductSizeSelector / ProductBuyButton, sin cambios).
// Se oculta mientras el selector está en pantalla. Deja libre la esquina
// derecha para el botón flotante de chat (52px en right-3/bottom-4,
// ver ChatWidget) y queda alineada con él.
export default function ProductStickyBar({ targetId, label }) {
  // Arranca oculta y el observer decide en el primer frame (sin parpadeo
  // sobre el selector si la página se abre ya scrolleada).
  const [show, setShow] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    // rootMargin: el selector cuenta como "en pantalla" recién cuando entra
    // al 65% superior de la pantalla (si solo asoma el precio abajo, la
    // barra sigue visible).
    const observer = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), {
      threshold: 0,
      rootMargin: "0px 0px -35% 0px",
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  const onClick = (e) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={onClick}
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      className={`fixed bottom-4 left-4 right-[76px] z-40 flex h-[52px] items-center justify-center rounded-full bg-accent px-5 text-center text-[15px] font-semibold text-white shadow-lg shadow-accent/30 transition-all duration-300 active:bg-accent-soft md:hidden ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-24 opacity-0"
      }`}
    >
      {label}
    </a>
  );
}
