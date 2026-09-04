"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "../components/PasswordInput";

export default function EstudioLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/estudio-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo iniciar sesión");
      }

      // La cookie ya quedó guardada por el endpoint; refrescamos la ruta
      // para que app/estudio/page.js (server component) la lea y muestre
      // el editor en vez de este formulario.
      router.refresh();
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-black/5 bg-[#fffaf0] p-6 shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)]"
      >
        <div className="text-center">
          <h1 className="font-heading text-lg font-semibold text-[#1b2a4a]">Estudio Mystery</h1>
          <p className="mt-1 text-sm text-[#5b6b8c]">Acceso interno — ingresa la contraseña</p>
        </div>

        <PasswordInput
          autoFocus
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting || !password}
          className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
