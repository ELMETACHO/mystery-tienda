"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo iniciar sesión");
      }

      // La cookie ya quedó guardada por el endpoint; refrescamos la ruta
      // para que app/admin/layout.js (server component) la lea y
      // muestre el panel en vez de este formulario — funciona igual sin
      // importar en qué subruta de /admin estabas (layout envuelve a
      // todas).
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
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_0_40px_-14px_rgba(168,85,247,0.3)]"
      >
        <div className="text-center">
          <h1 className="text-lg font-semibold text-zinc-100">Admin — Mystery</h1>
          <p className="mt-1 text-sm text-zinc-500">Acceso interno — ingresa la contraseña</p>
        </div>

        <input
          type="password"
          autoFocus
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

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
