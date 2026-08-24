"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCOP } from "../../lib/order";

const PERIOD_OPTIONS = [
  { value: "1m", label: "Último mes" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "all", label: "Histórico" },
];

// Mismo orden/valores que EXPENSE_CATEGORIES en app/lib/financeReport.js
// — "Retiro Skydropx" es para registrar la comisión (2% + comisión
// bancaria) SOLO cuando efectivamente se retira saldo de Skydropx al
// banco; si el saldo se deja como crédito dentro de Skydropx, no hay
// gasto real que registrar todavía.
const EXPENSE_CATEGORIES = ["Publicidad", "Insumos", "Retiro Skydropx"];

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

// El input de "Monto en COP" es texto, no type="number": un <input
// type="number"> interpreta el "." como separador DECIMAL (formato
// inglés) — escribir "10.000" ahí se leía como el número 10, no como
// diez mil pesos. Estos dos helpers son locales a este archivo nada
// más (no tocar formatCOP() de app/lib/order.js, que ya funciona bien
// en el resto del sitio): quitan todo lo que no sea dígito y vuelven a
// insertar los puntos de miles mientras se escribe, sin decimales (los
// pesos colombianos no se manejan con centavos en la práctica).
function digitsOnly(value) {
  return value.replace(/\D/g, "");
}

function formatThousands(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseExpenseAmount(formattedValue) {
  const digits = digitsOnly(formattedValue);
  return digits ? Number(digits) : 0;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Fila de una métrica del reporte — mismo layout para todas, con signo
// "−" en las que restan de la utilidad, para que quede claro de un
// vistazo cómo se llega al número final.
function MetricRow({ label, amount, subtract }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-3 last:border-0">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className={`font-semibold ${subtract ? "text-red-300" : "text-zinc-100"}`}>
        {subtract ? "− " : ""}
        {formatCOP(amount)}
      </span>
    </div>
  );
}

export default function ReporteApp() {
  const [period, setPeriod] = useState("1m");
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISODate());
  const [description, setDescription] = useState("");
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState("");

  const loadReport = useCallback(async (selectedPeriod) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin-report?period=${selectedPeriod}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo cargar el reporte");
      setReport(json);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar el reporte financiero.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport(period);
  }, [period, loadReport]);

  const expenseAmountValue = parseExpenseAmount(amount);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseAmountValue || expenseAmountValue <= 0 || !date) return;

    setIsSubmittingExpense(true);
    setExpenseError("");
    try {
      const res = await fetch("/api/admin-add-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, amount: expenseAmountValue, date, description }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo guardar el gasto");

      setAmount("");
      setDescription("");
      setDate(todayISODate());
      // Recalcula el reporte del período actual sin recargar la página —
      // el gasto nuevo solo entra si su fecha cae dentro del rango
      // seleccionado (ver computeFinanceReport en
      // app/lib/financeReport.js).
      await loadReport(period);
    } catch (err) {
      console.error(err);
      setExpenseError(err.message);
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const netProfitPositive = report ? report.netProfit >= 0 : true;

  return (
    <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Reporte financiero</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Ingresos, costos, comisiones y utilidad neta.
          </p>
        </div>
        <a
          href="/admin"
          className="shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-accent/40 hover:text-accent-soft"
        >
          ← Admin
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPeriod(opt.value)}
            className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
              period === opt.value
                ? "bg-accent text-white"
                : "border border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {isLoading || !report ? (
        <p className="text-sm text-zinc-500">Cargando...</p>
      ) : (
        <>
          <div
            className={`rounded-2xl border p-5 text-center shadow-[0_0_40px_-14px_rgba(168,85,247,0.3)] sm:p-6 ${
              netProfitPositive
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-red-500/30 bg-red-500/10"
            }`}
          >
            <p className="text-sm text-zinc-400">Utilidad neta</p>
            <p
              className={`text-2xl font-bold sm:text-3xl ${
                netProfitPositive ? "text-emerald-300" : "text-red-300"
              }`}
            >
              {formatCOP(report.netProfit)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {report.orderCount} pedido{report.orderCount === 1 ? "" : "s"} en el período
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-5">
            <MetricRow label="Ingresos" amount={report.revenue} />
            <MetricRow label="Costo fabricante" amount={report.fabricanteCost} subtract />
            <MetricRow label="Comisión Wompi" amount={report.wompiFee} subtract />
            <MetricRow label="Costo de envío" amount={report.shippingCost} subtract />
            <MetricRow label="Comisión referidos pagada" amount={report.referralsPaid} subtract />
            <MetricRow label="Gastos manuales" amount={report.expensesTotal} subtract />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-sm font-medium text-zinc-300">Agregar gasto manual</h2>
            <form onSubmit={handleAddExpense} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-zinc-900">
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30"
                />
              </div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Monto en COP (ej: 10.000)"
                value={amount}
                onChange={(e) => setAmount(formatThousands(digitsOnly(e.target.value)))}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30"
              />
              <input
                type="text"
                placeholder="Descripción (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30"
              />
              {expenseError && <p className="text-xs text-red-400">{expenseError}</p>}
              <button
                type="submit"
                disabled={isSubmittingExpense || !expenseAmountValue || expenseAmountValue <= 0}
                className="self-start rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmittingExpense ? "Guardando..." : "Agregar gasto"}
              </button>
            </form>
          </div>

          {report.expenses.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-zinc-300">
                Gastos manuales en este período
              </h2>
              <ul className="flex flex-col gap-2">
                {report.expenses.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm text-zinc-100">
                        {e.category}
                        {e.description ? ` — ${e.description}` : ""}
                      </span>
                      <span className="text-xs text-zinc-500">{formatDate(e.date)}</span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-red-300">
                      − {formatCOP(e.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
