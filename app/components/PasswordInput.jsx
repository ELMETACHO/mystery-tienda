"use client";

import { useState } from "react";

// Input de contraseña con el clásico "ojito" para revelar/ocultar el
// texto — reutilizado en las pantallas de login internas (/admin,
// /estudio) donde antes solo había un input type="password" normal.
export default function PasswordInput({ className = "", ...rest }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...rest}
        type={visible ? "text" : "password"}
        className={`w-full pr-11 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        tabIndex={-1}
        className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#5b6b8c] transition-colors hover:text-[#1b2a4a]"
      >
        {visible ? (
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path
              d="M3 3l18 18M10.6 10.6a2.5 2.5 0 0 0 3.5 3.5M9.9 5.2A9.9 9.9 0 0 1 12 5c5 0 9 4 10 7-.4 1.1-1.1 2.3-2.1 3.4M6.6 6.6C4.6 8 3.2 9.9 2 12c1 3 5 7 10 7 1.3 0 2.5-.3 3.6-.7"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path
              d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        )}
      </button>
    </div>
  );
}
