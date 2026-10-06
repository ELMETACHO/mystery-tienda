"use client";

import { useEffect, useState } from "react";

// Barra fija de móvil (oct 2026): SOLO baja hasta el selector de tamaño
// (#elegir-tamano). No agrega al carrito, no abre el checkout ni toca el
// flujo de pago: el cliente elige tamaño y paga con los botones de
// siempre (ProductSizeSelector / ProductBuyButton, sin cambios).
// Mientras el selector está en pantalla el botón se cambia por un texto.
// La esquina derecha es del botón de chat (52px, ver ChatWidget).
export default function ProductStickyBar({ targetId, label, infoText }) {
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

  // Barra inferior SIEMPRE presente en móvil (fondo crema translúcido):
  // el botón de chat vive en su esquina derecha (ver ChatWidget), así no
  // flota sobre el contenido. A la izquierda: el botón "Elegir tamaño"
  // mientras el selector no está en pantalla; cuando está a la vista, solo
  // un texto informativo (no dos botones morados a la vez).
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-[#fffaf0]/90 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pl-4 pr-[76px] pt-3 shadow-[0_-8px_24px_-16px_rgba(30,20,60,0.35)] backdrop-blur-md md:hidden">
      {show ? (
        <a
          href={`#${targetId}`}
          onClick={onClick}
          className="flex h-[52px] items-center justify-center rounded-full bg-accent px-5 text-center text-[15px] font-semibold text-white shadow-lg shadow-accent/30 active:bg-accent-soft"
        >
          {label}
        </a>
      ) : (
        <p className="flex h-[52px] items-center justify-center text-center text-xs font-medium leading-snug text-[#33456b]">
          {infoText}
        </p>
      )}
    </div>
  );
}
