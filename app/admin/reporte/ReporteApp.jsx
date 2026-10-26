"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCOP, SIZES } from "../../lib/order";
import { AD_PLATFORMS, AD_PLATFORM_LABELS } from "../../lib/financeRules";

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

// Regla de pauta (ver ADS.md): escalar solo si el CPA queda por debajo de esto.
const CPA_TARGET_COP = 25000;

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

const inputClass =
  "rounded-xl border border-black/10 bg-[#fffaf0] px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30";

// Fila de una métrica del reporte — mismo layout para todas, con signo
// "−" en las que restan de la utilidad, para que quede claro de un
// vistazo cómo se llega al número final.
function MetricRow({ label, amount, subtract }) {
  return (
    <div className="flex items-center justify-between border-b border-black/5 py-3 last:border-0">
      <span className="text-sm text-[#33456b]">{label}</span>
      <span className={`font-semibold ${subtract ? "text-red-300" : "text-[#1b2a4a]"}`}>
        {subtract ? "− " : ""}
        {formatCOP(amount)}
      </span>
    </div>
  );
}

// Pauta por plataforma: gasto, ventas que llegaron desde un anuncio de esa
// plataforma (solo pedidos con origen guardado), CPA y ROAS.
function AdsSection({ ads, orderCount }) {
  if (!ads || ads.spend === 0) {
    return (
      <div className="rounded-2xl border border-black/10 bg-[#fffaf0] p-5">
        <h2 className="text-sm font-medium text-[#33456b]">Pauta y CPA</h2>
        <p className="mt-2 text-sm text-[#5b6b8c]">
          Sin gastos de Publicidad en este período: las {orderCount} ventas son orgánicas.
        </p>
      </div>
    );
  }

  const cpaOk = ads.blendedCpa !== null && ads.blendedCpa < CPA_TARGET_COP;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-[#fffaf0] p-5">
      <h2 className="text-sm font-medium text-[#33456b]">Pauta y CPA</h2>
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#33456b]">Pauta total</span>
        <span className="font-semibold text-[#1b2a4a]">{formatCOP(ads.spend)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#33456b]">CPA mezclado (pauta ÷ todas las ventas)</span>
        <span className={`font-semibold ${cpaOk ? "text-emerald-700" : "text-red-300"}`}>
          {ads.blendedCpa === null ? "—" : formatCOP(ads.blendedCpa)}
        </span>
      </div>
      <p className="text-xs text-[#5b6b8c]">
        Meta: CPA menor a {formatCOP(CPA_TARGET_COP)} antes de subir presupuesto.
      </p>
      <ul className="flex flex-col gap-2">
        {ads.platforms.map((p) => (
          <li key={p.platform} className="rounded-xl border border-black/10 px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[#1b2a4a]">{AD_PLATFORM_LABELS[p.platform]}</span>
              <span className="font-semibold text-[#1b2a4a]">{formatCOP(p.spend)}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-[#5b6b8c]">
              <span>Ventas desde anuncios: {p.orders}</span>
              <span>CPA: {p.cpa === null ? "—" : formatCOP(p.cpa)}</span>
              <span>ROAS: {p.roas === null ? "—" : `${p.roas.toFixed(1)}x`}</span>
            </div>
          </li>
        ))}
      </ul>
      {ads.ordersWithChannel === 0 && (
        <p className="text-xs text-[#5b6b8c]">
          Los pedidos de este período no guardan de qué canal vino el cliente, así que el CPA y
          el ROAS por plataforma no se pueden calcular todavía (solo el mezclado).
        </p>
      )}
    </div>
  );
}

// Margen real de cada pedido: precio − fabricante − guía − Wompi −
// materiales (si están configurados abajo).
function OrdersMarginSection({ orders, hasMaterials }) {
  if (!orders.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-[#33456b]">Margen por pedido</h2>
      <p className="text-xs text-[#5b6b8c]">
        Precio − fabricante − guía − Wompi
        {hasMaterials ? " − materiales." : ". Sin materiales: configúralos abajo."}
      </p>
      <ul className="flex flex-col gap-2">
        {orders.map((o) => (
          <li
            key={o.reference}
            className="flex flex-col gap-1 rounded-xl border border-black/10 bg-[#fffaf0] px-4 py-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col">
                <span className="text-sm text-[#1b2a4a]">
                  {o.customerName} — {o.sizeLabel}
                  {o.frameType ? ` ${o.frameType}` : ""}
                </span>
                <span className="text-xs text-[#5b6b8c]">
                  {formatDate(o.purchasedAt)} ·{" "}
                  {o.paymentMethod === "cod" ? "Contraentrega" : "Pago en línea"}
                </span>
              </div>
              <span
                className={`shrink-0 text-sm font-semibold ${
                  o.margin < 0 ? "text-red-300" : "text-emerald-700"
                }`}
              >
                {formatCOP(o.margin)}
                {o.provisional ? "*" : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-[#5b6b8c]">
              <span>Precio {formatCOP(o.priceCOP)}</span>
              <span>
                Fabricante {formatCOP(o.commission)}
                {o.commissionEstimated ? " (estimado)" : ""}
              </span>
              <span>
                Guía{" "}
                {o.shipping === null
                  ? "pendiente"
                  : `${formatCOP(o.shipping)}${o.carrierName ? ` ${o.carrierName}` : ""}`}
              </span>
              <span>Wompi {formatCOP(o.wompi)}</span>
              {o.materials > 0 && <span>Materiales {formatCOP(o.materials)}</span>}
            </div>
          </li>
        ))}
      </ul>
      {orders.some((o) => o.provisional) && (
        <p className="text-xs text-[#5b6b8c]">* Provisional: todavía no tiene guía.</p>
      )}
    </div>
  );
}

// Costo de materiales por cuadro (madera + vinilo + soporte), uno por
// tamaño. Solo afecta el margen por pedido, nunca la utilidad neta (las
// compras de material ya entran como gasto "Insumos").
function MaterialsSection({ materialsBySize, onSaved }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      SIZES.map((s) => [s.id, materialsBySize[s.id] ? formatThousands(String(materialsBySize[s.id])) : ""])
    )
  );
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");

  const save = async (sizeId) => {
    setSavingId(sizeId);
    setError("");
    try {
      const res = await fetch("/api/admin-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sizeId, amount: parseExpenseAmount(values[sizeId]) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo guardar");
      await onSaved();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-[#fffaf0] p-5">
      <h2 className="text-sm font-medium text-[#33456b]">Costo de materiales por cuadro</h2>
      <p className="mt-1 text-xs text-[#5b6b8c]">
        Madera + vinilo + soporte. Solo cambia el margen por pedido; la utilidad neta ya resta
        las compras de material como gasto &quot;Insumos&quot;. Deja en blanco o en 0 para quitarlo.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {SIZES.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-sm text-[#1b2a4a]">{s.label}</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Sin dato"
              value={values[s.id]}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [s.id]: formatThousands(digitsOnly(e.target.value)) }))
              }
              className={`${inputClass} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={() => save(s.id)}
              disabled={savingId !== null}
              className="shrink-0 rounded-full border border-accent/40 px-4 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingId === s.id ? "..." : "Guardar"}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function ReporteApp() {
  const [period, setPeriod] = useState("1m");
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [platform, setPlatform] = useState(AD_PLATFORMS[0]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISODate());
  const [description, setDescription] = useState("");
  // id del gasto que se está editando (null = el formulario agrega uno nuevo).
  const [editingId, setEditingId] = useState(null);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial (fetch) al montar; el setState es intencional
    loadReport(period);
  }, [period, loadReport]);

  const expenseAmountValue = parseExpenseAmount(amount);

  const resetForm = () => {
    setEditingId(null);
    setAmount("");
    setDescription("");
    setDate(todayISODate());
  };

  const startEditing = (expense) => {
    setEditingId(expense.id);
    setCategory(expense.category);
    setPlatform(expense.platform || AD_PLATFORMS[0]);
    setAmount(formatThousands(String(expense.amount)));
    setDate(String(expense.date).slice(0, 10));
    setDescription(expense.description || "");
    setExpenseError("");
    document.getElementById("form-gasto")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    if (!expenseAmountValue || expenseAmountValue <= 0 || !date) return;

    setIsSubmittingExpense(true);
    setExpenseError("");
    try {
      const res = await fetch(editingId ? "/api/admin-update-expense" : "/api/admin-add-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          category,
          platform: category === "Publicidad" ? platform : null,
          amount: expenseAmountValue,
          date,
          description,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo guardar el gasto");

      resetForm();
      // Recalcula el reporte del período actual sin recargar la página —
      // el gasto solo entra si su fecha cae dentro del rango
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

  const handleDeleteExpense = async (expense) => {
    if (
      !confirm(
        `¿Borrar el gasto "${expense.category}${expense.description ? ` — ${expense.description}` : ""}" de ${formatCOP(expense.amount)}? No se puede deshacer.`
      )
    )
      return;

    setDeletingId(expense.id);
    setExpenseError("");
    try {
      const res = await fetch("/api/admin-delete-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: expense.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo borrar el gasto");
      if (editingId === expense.id) resetForm();
      await loadReport(period);
    } catch (err) {
      console.error(err);
      setExpenseError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const netProfitPositive = report ? report.netProfit >= 0 : true;

  return (
    <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">Reporte financiero</h1>
          <p className="mt-1 text-sm text-[#33456b]">
            Ingresos, costos, comisiones y utilidad neta.
          </p>
        </div>
        <a
          href="/admin"
          className="shrink-0 rounded-full border border-black/10 bg-[#fffaf0] px-4 py-2 text-xs font-medium text-[#33456b] transition-colors hover:border-accent/40 hover:text-accent"
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
                : "border border-black/10 bg-[#fffaf0] text-[#33456b] hover:text-[#1b2a4a]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isLoading || !report ? (
        <p className="text-sm text-[#5b6b8c]">Cargando...</p>
      ) : (
        <>
          <div
            className={`rounded-2xl border p-5 text-center shadow-[0_0_40px_-14px_rgba(168,85,247,0.3)] sm:p-6 ${
              netProfitPositive
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-red-500/30 bg-red-500/10"
            }`}
          >
            <p className="text-sm text-[#33456b]">Utilidad neta</p>
            <p
              className={`text-2xl font-bold sm:text-3xl ${
                netProfitPositive ? "text-emerald-700" : "text-red-300"
              }`}
            >
              {formatCOP(report.netProfit)}
            </p>
            <p className="mt-1 text-xs text-[#5b6b8c]">
              {report.orderCount} pedido{report.orderCount === 1 ? "" : "s"} en el período
              {report.orderCount > 0 &&
                ` · ticket promedio ${formatCOP(Math.round(report.revenue / report.orderCount))}`}
            </p>
            {report.testOrders.count > 0 && (
              <p className="mt-1 text-xs text-[#5b6b8c]">
                No cuenta {report.testOrders.count} compra
                {report.testOrders.count === 1 ? "" : "s"} de prueba (
                {formatCOP(report.testOrders.amount)}).
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-black/10 bg-[#fffaf0] px-5">
            <MetricRow label="Ingresos" amount={report.revenue} />
            <MetricRow label="Costo fabricante" amount={report.fabricanteCost} subtract />
            <MetricRow label="Comisión Wompi" amount={report.wompiFee} subtract />
            <MetricRow label="Costo de envío" amount={report.shippingCost} subtract />
            <MetricRow label="Comisión referidos pagada" amount={report.referralsPaid} subtract />
            <MetricRow label="Gastos manuales" amount={report.expensesTotal} subtract />
          </div>

          <AdsSection ads={report.ads} orderCount={report.orderCount} />

          <OrdersMarginSection
            orders={report.orders}
            hasMaterials={Object.keys(report.materialsBySize).length > 0}
          />

          <div id="form-gasto" className="rounded-2xl border border-black/10 bg-[#fffaf0] p-5">
            <h2 className="mb-4 text-sm font-medium text-[#33456b]">
              {editingId ? "Editar gasto" : "Agregar gasto manual"}
            </h2>
            <form onSubmit={handleSubmitExpense} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputClass}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-white text-[#1b2a4a]">
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              {category === "Publicidad" && (
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className={inputClass}
                  aria-label="Plataforma de la pauta"
                >
                  {AD_PLATFORMS.map((p) => (
                    <option key={p} value={p} className="bg-white text-[#1b2a4a]">
                      {AD_PLATFORM_LABELS[p]}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                inputMode="numeric"
                placeholder="Monto en COP (ej: 10.000)"
                value={amount}
                onChange={(e) => setAmount(formatThousands(digitsOnly(e.target.value)))}
                className={inputClass}
              />
              <input
                type="text"
                placeholder={
                  category === "Publicidad"
                    ? "Campaña (opcional, incluye impuestos en el monto)"
                    : "Descripción (opcional)"
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
              />
              {expenseError && <p className="text-xs text-red-600">{expenseError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmittingExpense || !expenseAmountValue || expenseAmountValue <= 0}
                  className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSubmittingExpense ? "Guardando..." : editingId ? "Guardar cambios" : "Agregar gasto"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-[#33456b] transition-colors hover:text-[#1b2a4a]"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          {report.expenses.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-[#33456b]">
                Gastos manuales en este período
              </h2>
              <ul className="flex flex-col gap-2">
                {report.expenses.map((e) => (
                  <li
                    key={e.id}
                    className={`flex flex-col gap-2 rounded-xl border bg-[#fffaf0] px-4 py-3 ${
                      editingId === e.id ? "border-accent/50" : "border-black/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-[#1b2a4a]">
                          {e.category}
                          {e.platform ? ` (${AD_PLATFORM_LABELS[e.platform]})` : ""}
                          {e.description ? ` — ${e.description}` : ""}
                        </span>
                        <span className="text-xs text-[#5b6b8c]">{formatDate(e.date)}</span>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-red-300">
                        − {formatCOP(e.amount)}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => startEditing(e)}
                        className="font-medium text-accent underline-offset-2 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(e)}
                        disabled={deletingId !== null}
                        className="font-medium text-red-600 underline-offset-2 hover:underline disabled:opacity-40"
                      >
                        {deletingId === e.id ? "Borrando..." : "Borrar"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <MaterialsSection
            key={JSON.stringify(report.materialsBySize)}
            materialsBySize={report.materialsBySize}
            onSaved={() => loadReport(period)}
          />
        </>
      )}
    </div>
  );
}
