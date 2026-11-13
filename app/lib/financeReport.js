import Redis from "ioredis";
import { SIZES } from "./order";
import { getCompletedOrders } from "./completedOrders";
import {
  FABRICANTE_IDS,
  getManufacturerPayouts,
  getAllManufacturerOrdersCombined,
} from "./manufacturerFinance";
import {
  AD_PLATFORMS,
  expensePlatform,
  isTestOrder,
  orderAdPlatform,
  orderChannel,
  orderMargin,
  wompiFeeForOrder,
} from "./financeRules";

// Historial de pagos combinado de TODOS los fabricantes — Premium y
// Tradicional se suman al mismo "costo de fabricación" del reporte
// general (Tradicional siempre aporta $0, ver getFabricanteCommissionCOP).
async function getAllManufacturerPayoutsCombined() {
  const results = await Promise.all(FABRICANTE_IDS.map((id) => getManufacturerPayouts(id)));
  return results.flat();
}
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
// Hash sizeId -> costo de materiales por cuadro (madera + vinilo + soporte)
// en COP, editable desde /admin/reporte. Solo se usa para el margen por
// pedido: la utilidad neta ya resta lo que se compra como gasto "Insumos",
// así que sumarlo ahí también lo contaría dos veces.
const MATERIALS_KEY = "finanzas:materiales";
// "Retiro Skydropx": la comisión (2% + comisión bancaria) que cobra
// Skydropx al transferir saldo a un banco — el admin la registra a mano
// SOLO cuando efectivamente retira (si deja el saldo como crédito dentro
// de Skydropx, no hay gasto real ese momento, ver CLAUDE.md/conversación).
export const EXPENSE_CATEGORIES = ["Publicidad", "Insumos", "Retiro Skydropx"];

// Devuelve los campos validados de un gasto, o null (con el motivo en
// consola) si algo no sirve. `platform` solo aplica a "Publicidad" (ver
// AD_PLATFORMS en app/lib/financeRules.js).
function validateExpenseFields({ category, amount, date, description, platform }) {
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
  return {
    category,
    amount: parsedAmount,
    date: parsedDate.toISOString(),
    description: description || "",
    platform:
      category === "Publicidad" ? (AD_PLATFORMS.includes(platform) ? platform : "otra") : null,
  };
}

// Nunca lanza: agregar un gasto es una acción manual del admin, un fallo
// de Redis simplemente hace que no se guarde — el llamador (la ruta API)
// decide qué mostrar según el resultado.
export async function addExpense(fields) {
  const client = getRedisClient();
  if (!client) {
    console.error("[financeReport] REDIS_URL no está configurado; no se guardó el gasto.");
    return null;
  }
  const valid = validateExpenseFields(fields);
  if (!valid) return null;

  const expense = {
    id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...valid,
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

// Botón "Editar" de un gasto en /admin/reporte: reemplaza sus campos
// (conserva id y createdAt). Se busca por id dentro de la lista y se
// reescribe solo esa posición. Devuelve el gasto actualizado o null.
export async function updateExpense(id, fields) {
  const client = getRedisClient();
  if (!client || !id) return null;
  const valid = validateExpenseFields(fields);
  if (!valid) return null;

  try {
    const raw = await client.lrange(EXPENSES_KEY, 0, -1);
    const index = raw.findIndex((r) => JSON.parse(r).id === id);
    if (index === -1) return null;

    const updated = { ...JSON.parse(raw[index]), ...valid, updatedAt: new Date().toISOString() };
    await client.lset(EXPENSES_KEY, index, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error("[financeReport] No se pudo editar el gasto:", err);
    return null;
  }
}

// Botón "Borrar" de un gasto (con confirmación en el panel): saca de la
// lista exactamente ese elemento (LREM por su valor guardado, una vez).
export async function deleteExpense(id) {
  const client = getRedisClient();
  if (!client || !id) return false;

  try {
    const raw = await client.lrange(EXPENSES_KEY, 0, -1);
    const entry = raw.find((r) => JSON.parse(r).id === id);
    if (!entry) return false;
    return (await client.lrem(EXPENSES_KEY, 1, entry)) === 1;
  } catch (err) {
    console.error("[financeReport] No se pudo borrar el gasto:", err);
    return false;
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

// Costo de materiales por tamaño ({ "30x40": 21000, ... }), ver MATERIALS_KEY.
export async function getMaterialsBySize() {
  const client = getRedisClient();
  if (!client) return {};

  try {
    const raw = await client.hgetall(MATERIALS_KEY);
    return Object.fromEntries(Object.entries(raw || {}).map(([k, v]) => [k, Number(v) || 0]));
  } catch (err) {
    console.error("[financeReport] No se pudo leer el costo de materiales:", err);
    return {};
  }
}

// Guarda el costo de materiales de un tamaño; 0 lo borra (vuelve a "sin dato").
export async function setMaterialCost(sizeId, amount) {
  const client = getRedisClient();
  if (!client) return false;
  if (!SIZES.some((s) => s.id === sizeId)) return false;
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed < 0) return false;

  try {
    if (parsed === 0) await client.hdel(MATERIALS_KEY, sizeId);
    else await client.hset(MATERIALS_KEY, sizeId, String(Math.round(parsed)));
    return true;
  } catch (err) {
    console.error("[financeReport] No se pudo guardar el costo de materiales:", err);
    return false;
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

// Arma el reporte completo para un período — todo recalculado al vuelo
// desde Redis, sin nada pre-agregado. `period` es uno de PERIODS.
export async function computeFinanceReport(period) {
  const startDate = getStartDate(period);

  const [completedOrders, payouts, referrals, allExpenses, manufacturerOrders, materialsBySize] =
    await Promise.all([
      getCompletedOrders(),
      getAllManufacturerPayoutsCombined(),
      getAllReferrals(),
      getExpenses(),
      getAllManufacturerOrdersCombined(),
      getMaterialsBySize(),
    ]);

  // Solo pedidos con priceCOP guardado (agregado agosto 2026 — pedidos
  // completados ANTES de eso no lo tienen y se excluyen del cálculo de
  // ingresos/comisión Wompi en vez de contar como $0, que subestimaría
  // la comisión sin avisar). Cuenta tanto "wompi" (pago completo) como
  // "cod" (contraentrega) — ambos son ventas reales, ver
  // app/api/confirm-cod-order/route.js. Las compras de prueba del dueño
  // quedan fuera (ver isTestOrder) y se informan aparte.
  const ordersWithPrice = completedOrders.filter(
    (o) => inRange(o.purchasedAt, startDate) && typeof o.priceCOP === "number"
  );
  const testOrders = ordersWithPrice.filter((o) => isTestOrder(o));
  const ordersInRange = ordersWithPrice.filter((o) => !isTestOrder(o));
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
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((e) => (e.category === "Publicidad" ? { ...e, platform: expensePlatform(e) } : e));
  const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  const netProfit =
    revenue - fabricanteCost - wompiFee - shippingCost - referralsPaid - expensesTotal;

  // Margen por pedido (más reciente primero). El registro del fabricante
  // trae la comisión y la guía reales; sin guía todavía queda provisional.
  const fabByReference = new Map(
    manufacturerOrders.filter((o) => o.status !== "cancelado").map((o) => [o.reference, o])
  );
  const orders = ordersInRange
    .map((o) => {
      const fabRecord = fabByReference.get(o.reference) || null;
      const m = orderMargin(o, fabRecord, materialsBySize);
      return {
        reference: o.reference,
        purchasedAt: o.purchasedAt,
        customerName: o.customerName,
        sizeLabel: o.sizeLabel,
        frameType: fabRecord?.frameType || null,
        paymentMethod: o.paymentMethod,
        priceCOP: o.priceCOP,
        channel: orderChannel(o),
        carrierName: fabRecord?.carrierName || null,
        ...m,
        wompi: Math.round(m.wompi),
        margin: Math.round(m.margin),
      };
    })
    .sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));

  // Pauta por plataforma + CPA. "Mezclado" = toda la pauta ÷ todas las
  // ventas (incluye orgánicas, así que es optimista). Por plataforma solo
  // cuentan los pedidos cuyo origen guardado es un anuncio de esa
  // plataforma (order.attribution); sin ese dato quedan en 0 ventas.
  const adExpenses = expenses.filter((e) => e.category === "Publicidad");
  const adSpend = adExpenses.reduce((sum, e) => sum + e.amount, 0);
  const ordersWithChannel = ordersInRange.filter((o) => orderChannel(o)).length;
  const adPlatforms = AD_PLATFORMS.map((platform) => {
    const spend = adExpenses
      .filter((e) => e.platform === platform)
      .reduce((sum, e) => sum + e.amount, 0);
    const attributed = ordersInRange.filter((o) => orderAdPlatform(o) === platform);
    const attributedRevenue = attributed.reduce((sum, o) => sum + o.priceCOP, 0);
    return {
      platform,
      spend,
      orders: attributed.length,
      revenue: attributedRevenue,
      cpa: attributed.length ? Math.round(spend / attributed.length) : null,
      // Sin ningún pedido con origen guardado, el ROAS sería un 0 engañoso.
      roas: spend && ordersWithChannel ? attributedRevenue / spend : null,
    };
  }).filter((p) => p.spend > 0 || p.orders > 0);

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
    testOrders: {
      count: testOrders.length,
      amount: testOrders.reduce((sum, o) => sum + o.priceCOP, 0),
    },
    orders,
    materialsBySize,
    ads: {
      spend: adSpend,
      blendedCpa:
        ordersInRange.length && adSpend ? Math.round(adSpend / ordersInRange.length) : null,
      ordersWithChannel,
      platforms: adPlatforms,
    },
  };
}
