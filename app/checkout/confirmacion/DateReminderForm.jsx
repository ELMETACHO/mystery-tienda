"use client";

import { useState } from "react";

// "¿Para qué fecha es? Te avisamos el próximo año" (oct 2026). Opcional y
// cerrado por defecto (<details>): nunca compite con el resumen del pedido.
// Lo guarda /api/date-reminder (ver app/lib/dateReminders.js); el correo de
// destino sale del pedido real, nunca de este formulario. Si falla, solo
// se muestra un mensaje: el pedido no se entera de nada.
// Las claves deben coincidir con OCCASIONS de app/lib/dateReminders.js
// (no se importa ese archivo acá porque usa ioredis/crypto del servidor).
const OCCASION_OPTIONS = [
  ["cumpleanos", "Cumpleaños"],
  ["aniversario", "Aniversario"],
  ["madre", "Día de la Madre"],
  ["padre", "Día del Padre"],
  ["amor_amistad", "Amor y Amistad"],
  ["navidad", "Navidad"],
  ["otra", "Otra fecha especial"],
];

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const FIELD = "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-[#1b2a4a] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export default function DateReminderForm({ reference }) {
  const [occasion, setOccasion] = useState("cumpleanos");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [forName, setForName] = useState("");
  const [status, setStatus] = useState("idle"); // idle | saving | done | error
  const [error, setError] = useState("");

  if (!reference) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === "saving") return;
    setStatus("saving");
    setError("");
    try {
      const res = await fetch("/api/date-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, occasion, day: Number(day), month: Number(month), forName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No pudimos guardarlo.");
      setStatus("done");
    } catch (err) {
      setError(err.message || "No pudimos guardarlo. Intenta más tarde.");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <p className="w-full rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3 text-center text-sm text-[#33456b]">
        ✅ Listo. Te escribiremos 2 semanas antes de esa fecha el próximo año.
      </p>
    );
  }

  return (
    <details className="w-full rounded-2xl border border-black/5 bg-[#fffaf0] px-4 py-3 text-left">
      <summary className="cursor-pointer text-sm font-medium text-[#1b2a4a]">
        🎂 ¿Es para una fecha especial? Te la recordamos el próximo año
      </summary>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2.5">
        <label className="flex flex-col gap-1 text-xs text-[#5b6b8c]">
          Ocasión
          <select className={FIELD} value={occasion} onChange={(e) => setOccasion(e.target.value)}>
            {OCCASION_OPTIONS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-[5rem_1fr] gap-2">
          <label className="flex flex-col gap-1 text-xs text-[#5b6b8c]">
            Día
            <input
              className={FIELD}
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              required
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[#5b6b8c]">
            Mes
            <select className={FIELD} required value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">Elige…</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs text-[#5b6b8c]">
          ¿Para quién? (opcional)
          <input
            className={FIELD}
            type="text"
            maxLength={40}
            placeholder="Ej: mi mamá"
            value={forName}
            onChange={(e) => setForName(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={status === "saving"}
          className="mt-1 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-soft disabled:opacity-60"
        >
          {status === "saving" ? "Guardando…" : "Recordármelo"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <p className="text-[11px] leading-snug text-[#8a94ac]">
          Un solo correo, 2 semanas antes de la fecha. Puedes cancelarlo desde ese mismo correo.
        </p>
      </form>
    </details>
  );
}
