import Redis from "ioredis";
import { COD_DEPOSIT_COP } from "./order";
import { getCompletedOrders } from "./completedOrders";
import { getManufacturerPayouts, getAllManufacturerOrders } from "./manufacturerFinance";
import { getAllReferrals } from "./referrals";

// Reporte financiero de /admin/reporte — combina datos que YA existían
// en Redis (completed-orders, fabricante:payouts, cada referral.payouts)
// más una lista nueva de gastos manuales (finanzas:expenses). Todo se
// calcula al vuelo por rango de fechas en cada request, nunca se guarda
// pre-agregado — mismo enfoque "leer directo de Redis" que el resto del
// panel de admin, sin Google Sheets ni servicios externos.

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.on("error", (err) => {
      console.error("[financeReport] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

const EXPENSES_KEY = "finanzas:expenses";
// "Retiro Skydropx": la comisión (2% + comisión bancaria) que cobra
// Skydropx al transferir saldo a un banco — el admin la registra a mano
// SOLO cuando efectivamente retira (si deja el saldo como crédito dentro
// de Skydropx, no hay gasto real ese momento, ver CLAUDE.md/conversación).
export const EXPENSE_CATEGORIES = ["Publicidad", "Insumos", "Retiro Skydropx"];

// Nunca lanza: agregar un gasto es una acción manual del admin, un fallo
// de Redis simplemente hace que no se guarde — el llamador (la ruta API)
// decide qué mostrar según el resultado.
export async function addExpense({ category, amount, date, description }) {
  const client = getRedisClient();
  if (!client) {
    console.error("[financeReport] REDIS_URL no está configurado; no se guardó el gasto.");
    return null;
  }
  if (!EXPENSE_CATEGORIES.includes(category)) {
    console.error(`[financeReport] Categoría de gasto inválida: ${category}`);
    return null;
  }
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    console.error(`[financeReport] Monto de gasto inválido: ${amount}`);
    return null;
  }
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    console.error(`[financeReport] Fecha de gasto inválida: ${date}`);
    return null;
  }

  const expense = {
    id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category,
    amount: parsedAmount,
    date: parsedDate.toISOString(),
    description: description || "",
    createdAt: new Date().toISOString(),
  };

  try {
    await client.rpush(EXPENSES_KEY, JSON.stringify(expense));
    return expense;
  } catch (err) {
    console.error("[financeReport] No se pudo guardar el gasto:", err);
    return null;
  }
}

// Todos los gastos manuales registrados, sin filtrar — el filtrado por
// período pasa por computeFinanceReport de abajo.
export async function getExpenses() {
  const client = getRedisClient();
  if (!client) return [];

  try {
    const raw = await client.lrange(EXPENSES_KEY, 0, -1);
    return raw.map((r) => JSON.parse(r));
  } catch (err) {
    console.error("[financeReport] No se pudieron leer los gastos:", err);
    return [];
  }
}

export const PERIODS = ["1m", "3m", "6m", "all"];

// null para "all" (histórico completo, sin límite inferior).
function getStartDate(period) {
  const months = { "1m": 1, "3m": 3, "6m": 6 }[period];
  if (!months) return null;

  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

function inRange(isoDate, startDate) {
  if (!startDate) return true;
  const d = new Date(isoDate);
  return !Number.isNaN(d.getTime()) && d >= startDate;
}

// Comisión real de Wompi en Colombia para tarjetas: 2.65% + $700 COP
// fijos, más IVA (19%) SOLO sobre esa comisión (no sobre el total de la
// venta) — se calcula al vuelo a partir del monto que REALMENTE pasó por
// Wompi en vez de guardarla pedido por pedido, porque la fórmula no
// cambia. Para pedidos "cod" eso es el anticipo fijo (COD_DEPOSIT_COP),
// NUNCA el priceCOP completo — el resto lo cobra el fabricante en
// efectivo al entregar, nunca pasa por Wompi.
const WOMPI_PERCENT_FEE = 0.0265;
const WOMPI_FIXED_FEE_COP = 700;
const WOMPI_IVA_RATE = 0.19;
function wompiFeeForOrder(order) {
  const chargedAmount = order.paymentMethod === "cod" ? COD_DEPOSIT_COP : order.priceCOP;
  const baseFee = chargedAmount * WOMPI_PERCENT_FEE + WOMPI_FIXED_FEE_COP;
  return baseFee * (1 + WOMPI_IVA_RATE);
}

// Arma el reporte completo para un período — todo recalculado al vuelo
// desde Redis, sin nada pre-agregado. `period` es uno de PERIODS.
export async function computeFinanceReport(period) {
  const startDate = getStartDate(period);

  const [completedOrders, payouts, referrals, allExpenses, manufacturerOrders] =
    await Promise.all([
      getCompletedOrders(),
      getManufacturerPayouts(),
      getAllReferrals(),
      getExpenses(),
      getAllManufacturerOrders(),
    ]);

  // Solo pedidos con priceCOP guardado (agregado agosto 2026 — pedidos
  // completados ANTES de eso no lo tienen y se excluyen del cálculo de
  // ingresos/comisión Wompi en vez de contar como $0, que subestimaría
  // la comisión sin avisar). Cuenta tanto "wompi" (pago completo) como
  // "cod" (contraentrega) — ambos son ventas reales, ver
  // app/api/confirm-cod-order/route.js.
  const ordersInRange = completedOrders.filter(
    (o) => inRange(o.purchasedAt, startDate) && typeof o.priceCOP === "number"
  );
  const revenue = ordersInRange.reduce((sum, o) => sum + o.priceCOP, 0);
  const wompiFee = ordersInRange.reduce((sum, o) => sum + wompiFeeForOrder(o), 0);

  const fabricanteCost = payouts
    .filter((p) => inRange(p.date, startDate))
    .reduce((sum, p) => sum + p.amount, 0);

  // Costo de envío: la guía cobrada por Skydropx en cada pedido (ver
  // app/lib/skydropx.js), excluyendo pedidos "cancelado" (Skydropx
  // reembolsa esa guía, ya no es un gasto real — ver
  // markManufacturerOrderCancelled).
  const shippingCost = manufacturerOrders
    .filter((o) => o.status !== "cancelado" && inRange(o.fecha, startDate))
    .reduce((sum, o) => sum + (o.shippingCostCOP || 0), 0);

  const referralsPaid = referrals
    .flatMap((r) => r.payouts || [])
    .filter((p) => inRange(p.date, startDate))
    .reduce((sum, p) => sum + p.amount, 0);

  const expenses = allExpenses
    .filter((e) => inRange(e.date, startDate))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  const netProfit =
    revenue - fabricanteCost - wompiFee - shippingCost - referralsPaid - expensesTotal;

  return {
    period,
    orderCount: ordersInRange.length,
    revenue,
    fabricanteCost,
    wompiFee: Math.round(wompiFee),
    shippingCost,
    referralsPaid,
    expensesTotal,
    expenses,
    netProfit: Math.round(netProfit),
  };
}
