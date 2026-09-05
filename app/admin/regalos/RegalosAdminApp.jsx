"use client";

import { useEffect, useState } from "react";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function RegalosAdminApp() {
  const [codes, setCodes] = useState(null);
  const [error, setError] = useState("");
  const [maxUsesInput, setMaxUsesInput] = useState("3");
  const [isCreating, setIsCreating] = useState(false);
  const [createdCode, setCreatedCode] = useState(null);

  const loadCodes = async () => {
    setError("");
    try {
      const res = await fetch("/api/admin-gift-codes");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar la lista");
      setCodes(data.codes);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la lista de códigos de regalo.");
    }
  };

  useEffect(() => {
    loadCodes();
  }, []);

  const handleCreate = async () => {
    const maxUses = parseInt(maxUsesInput, 10);
    if (!Number.isInteger(maxUses) || maxUses < 1) {
      setError("El número de usos debe ser un entero mayor a 0.");
      return;
    }

    setIsCreating(true);
    setError("");
    setCreatedCode(null);
    try {
      const res = await fetch("/api/admin-gift-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxUses }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo generar el código");
      setCreatedCode(data.code);
      // Se agrega arriba de la lista sin volver a pedirla completa —
      // mismo criterio que handleMarkPaid en ReferidosAdminApp.
      setCodes((prev) => [data.code, ...(prev || [])]);
    } catch (err) {
      console.error(err);
      setError(err.message || "No se pudo generar el código. Intenta de nuevo.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
            Códigos de regalo
          </h1>
          <p className="mt-1 text-sm text-[#33456b]">
            100% de descuento, solo para 40x50 — genera uno para regalar cuadros a
            influencers.
          </p>
        </div>
        <a
          href="/admin"
          className="shrink-0 rounded-full border border-black/10 bg-[#fffaf0] px-4 py-2 text-xs font-medium text-[#33456b] transition-colors hover:border-accent/40 hover:text-accent"
        >
          ← Admin
        </a>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-[#fffaf0] p-4">
        <p className="text-sm font-medium text-[#33456b]">Generar código nuevo</p>
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="max-uses" className="text-xs text-[#5b6b8c]">
              Usos permitidos
            </label>
            <input
              id="max-uses"
              type="number"
              min="1"
              step="1"
              value={maxUsesInput}
              onChange={(e) => setMaxUsesInput(e.target.value)}
              className="w-24 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30"
            />
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isCreating ? "Generando..." : "Generar código"}
          </button>
        </div>

        {createdCode && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <p className="text-xs text-emerald-700">Código generado — cópialo y compártelo:</p>
            <p className="font-mono text-lg font-bold tracking-wider text-emerald-800">
              {createdCode.code}
            </p>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {codes === null ? (
        <p className="text-sm text-[#5b6b8c]">Cargando...</p>
      ) : codes.length === 0 ? (
        <p className="rounded-xl border border-black/10 bg-[#fffaf0] px-4 py-6 text-center text-sm text-[#5b6b8c]">
          No hay códigos de regalo todavía.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {codes.map((c) => (
            <li
              key={c.code}
              className="flex items-center justify-between gap-4 rounded-2xl border border-black/10 bg-[#fffaf0] p-4"
            >
              <div className="flex flex-col">
                <span className="font-mono text-sm font-semibold tracking-wider text-[#1b2a4a]">
                  {c.code}
                </span>
                <span className="mt-1 text-xs text-[#5b6b8c]">
                  Creado el {formatDate(c.createdAt)} · solo 40x50
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    c.active
                      ? "bg-accent/15 text-accent"
                      : "bg-black/5 text-[#5b6b8c]"
                  }`}
                >
                  {c.active ? `${c.remainingUses} de ${c.maxUses} usos` : "Agotado"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
