// Resumen financiero diario de Mystery — de SOLO LECTURA sobre el Redis de
// PRODUCCIÓN. Nunca escribe, borra ni cambia saldos: el cliente de Redis va
// envuelto en una lista blanca de comandos de lectura y cualquier otro
// comando lanza un error ANTES de llegar a Redis.
//
// Lee lo mismo que /admin/reporte y /admin/finanzas (completed-orders,
// fabricante:<id>:orders/balance/payouts, finanzas:expenses, referral:*,
// manual-shipment:*, inventory:stock, finanzas:materiales) con las mismas
// reglas (app/lib/financeRules.js: comisión de Wompi, compras de prueba,
// margen por pedido, plataforma de pauta) y el tope de guía de
// app/lib/skydropx.js.
//
// Uso (desde la raíz del repo):
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/register.mjs scripts/finanzas-resumen.mjs [opciones]
// Opciones:
//   --fecha=AAAA-MM-DD   día a cerrar (hora Colombia). Por defecto, hoy.
//   --semana             agrega el resumen de los 7 días que terminan en --fecha.
//   --json               imprime los datos en JSON en vez de Markdown.
//   --out=ruta.md        además de imprimir, guarda el Markdown en ese archivo.
//
// Pauta por plataforma: además de los gastos "Publicidad" de /admin/reporte,
// lee (si existe) reportes-internos/finanzas/pauta.json — ignorado por git:
//   [{ "fecha": "2026-10-20", "plataforma": "tiktok", "campana": "Oct prueba", "monto": 25000 }]
// plataforma: tiktok | meta | google. Si un mismo gasto está en los dos
// lados, déjalo solo en uno (el script no adivina duplicados).
//
// La salida trae nombres de clientes abreviados (iniciales): los reportes
// van SOLO en reportes-internos/ (fuera de git), nunca en un commit.
import { readFileSync, writeFileSync, existsSync } from "fs";
import Redis from "ioredis";
import { SIZES, COD_FEE_COP } from "../app/lib/order";
import {
  expensePlatform,
  isTestOrder,
  orderChannel,
  orderMargin,
  wompiFeeForOrder,
} from "../app/lib/financeRules";

function loadEnvLocal() {
  let raw;
  try {
    raw = readFileSync(".env.local", "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    if (process.env[key]) continue;
    process.env[key] = match[2].trim().replace(/^['"]/, "").replace(/['"]$/, "");
  }
}

loadEnvLocal();

if (!process.env.REDIS_URL) {
  console.error("Falta REDIS_URL (revisa .env.local).");
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : true];
  })
);

// ---------- Redis de solo lectura ----------

const READ_ONLY_COMMANDS = new Set([
  "get", "mget", "lrange", "llen", "hget", "hgetall", "type", "ttl", "scan", "quit",
]);

const rawRedis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000 });
const redis = new Proxy(rawRedis, {
  get(target, prop) {
    const value = target[prop];
    if (typeof value !== "function" || typeof prop !== "string") return value;
    if (READ_ONLY_COMMANDS.has(prop.toLowerCase())) return value.bind(target);
    if (["on", "once", "disconnect"].includes(prop)) return value.bind(target);
    return () => {
      throw new Error(`Comando "${prop}" bloqueado: este script es de solo lectura.`);
    };
  },
});

async function scanKeys(pattern) {
  const keys = [];
  let cursor = "0";
  do {
    const [next, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 500);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== "0");
  return keys;
}

function parseList(raw) {
  return raw
    .map((r) => {
      try {
        return JSON.parse(r);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// ---------- Reglas del negocio (copiadas del código del sitio) ----------

const FABRICANTE_IDS = ["daniela", "oscar"];
const FABRICANTE_LABELS = { daniela: "Cris Premium", oscar: "Cris Tradicional" };

// app/lib/skydropx.js (MAX_SHIPPING_COST_COP + maxShippingCOP de los grandes,
// +COD_FEE_COP en contraentrega desde el 23 oct)
const MAX_SHIPPING_COST_COP = 26000;
const COD_FEE_START = "2026-10-23";
function shippingCap(sizeId, isCod) {
  const base = SIZES.find((s) => s.id === sizeId)?.maxShippingCOP ?? MAX_SHIPPING_COST_COP;
  return base + (isCod ? COD_FEE_COP : 0);
}

// ---------- Fechas (Colombia = UTC-5, sin horario de verano) ----------

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
function bogotaDay(iso) {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : new Date(t - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}
function addDays(day, n) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const today = bogotaDay(new Date().toISOString());
const reportDay = typeof args.fecha === "string" ? args.fecha : today;
if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDay)) {
  console.error("--fecha debe ser AAAA-MM-DD");
  process.exit(1);
}
const monthPrefix = reportDay.slice(0, 7);
const weekStart = addDays(reportDay, -6);
const inMonth = (day) => day && day.startsWith(monthPrefix) && day <= reportDay;
const inWeek = (day) => day && day >= weekStart && day <= reportDay;

// ---------- Utilidades de formato ----------

const cop = (n) =>
  n == null || Number.isNaN(n) ? "—" : `$${Math.round(n).toLocaleString("es-CO")}`;
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");
function initials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "—";
  return `${words[0][0].toUpperCase()}${words[0].slice(1).toLowerCase()} ${words
    .slice(1)
    .map((w) => `${w[0].toUpperCase()}.`)
    .join("")}`.trim();
}
const shortRef = (ref) => String(ref || "").replace(/^mystery-/, "");

// ---------- Lectura ----------

const [completedRaw, expensesRaw, stockRaw, materialsRaw] = await Promise.all([
  redis.lrange("completed-orders", 0, -1),
  redis.lrange("finanzas:expenses", 0, -1),
  redis.hgetall("inventory:stock"),
  redis.hgetall("finanzas:materiales"),
]);
const completed = parseList(completedRaw);
// Los gastos manuales guardan solo el día (medianoche UTC del día elegido en
// /admin/reporte): se toma ese día tal cual, sin pasarlo a hora Colombia.
const expenses = parseList(expensesRaw).map((e) => ({ ...e, day: String(e.date).slice(0, 10) }));

const fab = {};
for (const id of FABRICANTE_IDS) {
  const [balance, orders, payouts] = await Promise.all([
    redis.get(`fabricante:${id}:balance`),
    redis.hgetall(`fabricante:${id}:orders`),
    redis.lrange(`fabricante:${id}:payouts`, 0, -1),
  ]);
  fab[id] = {
    balance: Number(balance) || 0,
    orders: Object.entries(orders || {}).map(([reference, raw]) => ({
      reference,
      fabricanteId: id,
      ...JSON.parse(raw),
    })),
    payouts: parseList(payouts),
  };
}
const fabOrders = FABRICANTE_IDS.flatMap((id) => fab[id].orders);

const shipmentKeys = (await scanKeys("manual-shipment:*")).filter((k) => k.split(":").length === 2);
const shipments = shipmentKeys.length ? parseList((await redis.mget(...shipmentKeys)).filter(Boolean)) : [];

const referralKeys = (await scanKeys("referral:*")).filter((k) => k.split(":").length === 2);
const referrals = referralKeys.length ? parseList((await redis.mget(...referralKeys)).filter(Boolean)) : [];

let pauta = [];
const pautaPath = "reportes-internos/finanzas/pauta.json";
if (existsSync(pautaPath)) {
  try {
    pauta = JSON.parse(readFileSync(pautaPath, "utf8"));
  } catch (err) {
    console.error(`No se pudo leer ${pautaPath}: ${err.message}`);
  }
}

// Costo de materiales por cuadro (madera, vinilo, soporte): el que se
// configura en /admin/reporte (finanzas:materiales). Si no hay, se puede
// poner a mano en reportes-internos/finanzas/config.json →
// { "materialesPorTamano": { "30x40": 21000 } }
let materialesPorTamano = Object.fromEntries(
  Object.entries(materialsRaw || {}).map(([k, v]) => [k, Number(v) || 0])
);
const configPath = "reportes-internos/finanzas/config.json";
if (!Object.keys(materialesPorTamano).length && existsSync(configPath)) {
  try {
    materialesPorTamano = JSON.parse(readFileSync(configPath, "utf8")).materialesPorTamano || {};
  } catch (err) {
    console.error(`No se pudo leer ${configPath}: ${err.message}`);
  }
}
const conMateriales = Object.keys(materialesPorTamano).length > 0;

await rawRedis.quit();

// ---------- Pedidos reales con su margen ----------

const fabByRef = new Map();
for (const o of fabOrders) {
  if (!fabByRef.has(o.reference)) fabByRef.set(o.reference, []);
  fabByRef.get(o.reference).push(o);
}

const realOrders = completed
  .filter((o) => typeof o.priceCOP === "number" && !isTestOrder(o))
  .map((o) => {
    const day = bogotaDay(o.purchasedAt);
    const fabRecord = (fabByRef.get(o.reference) || []).find((f) => f.status !== "cancelado");
    const isCod = o.paymentMethod === "cod";
    const m = orderMargin(o, fabRecord || null, materialesPorTamano);
    const { sizeId, commission: comision, shipping: guia, wompi, materials: materiales, margin: margen } = m;
    return {
      reference: o.reference,
      day,
      cliente: initials(o.customerName),
      sizeId,
      frameType: fabRecord?.frameType || null,
      origen: o.productId ? "catálogo" : "foto propia",
      paymentMethod: isCod ? "contraentrega" : "en línea",
      priceCOP: o.priceCOP,
      codFeeCOP: o.codFeeCOP || 0,
      comision,
      comisionEstimada: m.commissionEstimated,
      guia,
      carrier: fabRecord?.carrierName || null,
      tope: shippingCap(sizeId, isCod && day >= COD_FEE_START),
      wompi,
      materiales,
      margen,
      margenProvisional: m.provisional,
      canal: orderChannel(o),
    };
  })
  .sort((a, b) => (a.day < b.day ? -1 : 1));

function summarize(orders) {
  const count = orders.length;
  const revenue = orders.reduce((s, o) => s + o.priceCOP, 0);
  const margen = orders.reduce((s, o) => s + o.margen, 0);
  const cod = orders.filter((o) => o.paymentMethod === "contraentrega").length;
  const mix = {};
  for (const o of orders) mix[o.sizeId] = (mix[o.sizeId] || 0) + 1;
  return { count, revenue, ticket: count ? revenue / count : 0, margen, cod, online: count - cod, mix };
}

const dayOrders = realOrders.filter((o) => o.day === reportDay);
const monthOrders = realOrders.filter((o) => inMonth(o.day));
const weekOrders = realOrders.filter((o) => inWeek(o.day));
const allOrders = realOrders.filter((o) => o.day <= reportDay);

// ---------- Pauta por plataforma ----------

const adSpend = [
  ...expenses
    .filter((e) => e.category === "Publicidad")
    .map((e) => ({
      day: e.day,
      plataforma: expensePlatform(e),
      monto: e.amount,
      descripcion: e.description || "",
      fuente: "/admin/reporte",
    })),
  ...pauta.map((p) => ({
    day: p.fecha,
    plataforma: String(p.plataforma || "").toLowerCase() || null,
    monto: Number(p.monto) || 0,
    descripcion: p.campana || "",
    fuente: "pauta.json",
  })),
];

// ---------- Utilidad del mes (misma fórmula que /admin/reporte) ----------

function profitFor(dayFilter) {
  const orders = realOrders.filter((o) => dayFilter(o.day));
  const revenue = orders.reduce((s, o) => s + o.priceCOP, 0);
  const wompi = orders.reduce((s, o) => s + o.wompi, 0);
  // Fabricación en base "devengada": comisión de cada guía real creada en el
  // período (no el día en que Oscar le pagó a Cris, que es como lo suma
  // /admin/reporte). Envíos: guías activas del período.
  const fabActive = fabOrders.filter((f) => f.status !== "cancelado" && dayFilter(bogotaDay(f.fecha)));
  const fabricacion = fabActive.reduce((s, f) => s + (f.monto || 0), 0);
  const envios = fabActive.reduce((s, f) => s + (f.shippingCostCOP || 0), 0);
  const referidos = referrals
    .flatMap((r) => r.payouts || [])
    .filter((p) => dayFilter(bogotaDay(p.date)))
    .reduce((s, p) => s + (p.amount || 0), 0);
  const gastos = expenses.filter((e) => dayFilter(e.day));
  const publicidad = gastos.filter((e) => e.category === "Publicidad").reduce((s, e) => s + e.amount, 0);
  const otrosGastos = gastos.filter((e) => e.category !== "Publicidad").reduce((s, e) => s + e.amount, 0);
  const pautaExtra = pauta
    .filter((p) => dayFilter(p.fecha))
    .reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const pagosCris = FABRICANTE_IDS.flatMap((id) => fab[id].payouts)
    .filter((p) => dayFilter(bogotaDay(p.date)))
    .reduce((s, p) => s + p.amount, 0);
  const utilidad = revenue - wompi - fabricacion - envios - referidos - publicidad - pautaExtra - otrosGastos;
  return {
    pedidos: orders.length,
    revenue,
    wompi,
    fabricacion,
    envios,
    referidos,
    publicidad: publicidad + pautaExtra,
    otrosGastos,
    utilidad,
    pagosCris,
  };
}

// /admin/reporte "1m": desde hoy menos un mes (corrido), pagos a Cris por
// fecha de pago, sin compras de prueba.
function adminReporte1m() {
  const start = new Date(`${reportDay}T23:59:59-05:00`);
  start.setMonth(start.getMonth() - 1);
  const startDay = bogotaDay(start.toISOString());
  const f = (day) => day && day >= startDay && day <= reportDay;
  const all = completed.filter(
    (o) => typeof o.priceCOP === "number" && !isTestOrder(o) && f(bogotaDay(o.purchasedAt))
  );
  const revenue = all.reduce((s, o) => s + o.priceCOP, 0);
  const wompi = all.reduce((s, o) => s + wompiFeeForOrder(o), 0);
  const fabricacion = FABRICANTE_IDS.flatMap((id) => fab[id].payouts)
    .filter((p) => f(bogotaDay(p.date)))
    .reduce((s, p) => s + p.amount, 0);
  const envios = fabOrders
    .filter((o) => o.status !== "cancelado" && f(bogotaDay(o.fecha)))
    .reduce((s, o) => s + (o.shippingCostCOP || 0), 0);
  const referidos = referrals
    .flatMap((r) => r.payouts || [])
    .filter((p) => f(bogotaDay(p.date)))
    .reduce((s, p) => s + p.amount, 0);
  const gastos = expenses.filter((e) => f(e.day)).reduce((s, e) => s + e.amount, 0);
  return {
    desde: startDay,
    pedidos: all.length,
    revenue,
    utilidad: revenue - fabricacion - wompi - envios - referidos - gastos,
  };
}

// ---------- Contraentrega vs en línea (efecto del recargo del 23 oct) ----------

function codShare(filter) {
  const o = allOrders.filter((x) => filter(x.day));
  const cod = o.filter((x) => x.paymentMethod === "contraentrega").length;
  return { total: o.length, cod, online: o.length - cod };
}
const codAntes = codShare((d) => d < COD_FEE_START);
const codAntes30 = codShare((d) => d < COD_FEE_START && d >= addDays(COD_FEE_START, -30));
const codDespues = codShare((d) => d >= COD_FEE_START);

// ---------- Anomalías ----------

const anomalies = []; // { nivel: "alta" | "media" | "info", texto }

for (const o of allOrders) {
  if (!o.margenProvisional && o.margen < 0) {
    anomalies.push({ nivel: "alta", texto: `Venta con PÉRDIDA: ${shortRef(o.reference)} (${o.cliente}, ${o.sizeId}) dejó ${cop(o.margen)}.` });
  }
}
for (const o of allOrders) {
  if (o.guia != null && o.guia > o.tope) {
    anomalies.push({
      nivel: inMonth(o.day) ? "alta" : "info",
      texto: `Guía por encima del tope: ${shortRef(o.reference)} costó ${cop(o.guia)} (${o.carrier}) vs tope ${cop(o.tope)}.`,
    });
  }
}

// Guías duplicadas: mismo pedido con 2+ guías activas, o mismo número de guía en 2 pedidos.
for (const [ref, list] of fabByRef) {
  const active = list.filter((f) => f.status !== "cancelado");
  if (active.length > 1) {
    anomalies.push({ nivel: "alta", texto: `Pedido ${shortRef(ref)} tiene ${active.length} guías activas (posible duplicado cobrado).` });
  }
}
const byTracking = new Map();
for (const f of fabOrders.filter((x) => x.status !== "cancelado" && x.trackingNumber)) {
  byTracking.set(f.trackingNumber, [...(byTracking.get(f.trackingNumber) || []), f.reference]);
}
for (const [tn, refs] of byTracking) {
  if (refs.length > 1) anomalies.push({ nivel: "alta", texto: `La guía ${tn} aparece en ${refs.length} pedidos: ${refs.map(shortRef).join(", ")}.` });
}
const seenRefs = new Map();
for (const o of completed) seenRefs.set(o.reference, (seenRefs.get(o.reference) || 0) + 1);
for (const [ref, n] of seenRefs) {
  if (n > 1) anomalies.push({ nivel: "alta", texto: `El pedido ${shortRef(ref)} está ${n} veces en completed-orders (la venta se contaría doble).` });
}

// Sin cobertura → devolución a mano pendiente (la hace Oscar por Wompi/Nequi).
for (const s of shipments) {
  if (s.status === "no_coverage") {
    anomalies.push({
      nivel: "alta",
      texto: `Pedido SIN COBERTURA ${shortRef(s.reference)} (${initials(s.customer?.fullName)}): guía cotizada ${cop(s.shippingCostCOP)} sobre el tope. Revisar que la devolución ya se hizo.`,
    });
  } else if (s.noCoverageAt && s.status !== "no_coverage") {
    anomalies.push({ nivel: "info", texto: `${shortRef(s.reference)} se marcó "sin cobertura" el ${bogotaDay(s.noCoverageAt)} pero después sí se generó la guía (resuelto a mano).` });
  }
}

// Pedidos pagados que llevan 5+ días sin guía.
for (const o of allOrders) {
  const hasGuide = (fabByRef.get(o.reference) || []).some((f) => f.status !== "cancelado");
  const age = (new Date(`${reportDay}T12:00:00Z`) - new Date(`${o.day}T12:00:00Z`)) / 86400000;
  if (!hasGuide && age >= 5) {
    anomalies.push({ nivel: "media", texto: `${shortRef(o.reference)} (${o.cliente}) se pagó hace ${Math.round(age)} días y todavía no tiene guía registrada.` });
  }
}
for (const f of fabOrders.filter((x) => x.status === "cancelado")) {
  anomalies.push({ nivel: "info", texto: `Guía cancelada sin regenerar: ${shortRef(f.reference)} (${bogotaDay(f.cancelledAt)}): ${f.cancelReason || "sin motivo"}.` });
}

// Saldo de Cris: el balance debe ser la suma de lo pendiente activo.
for (const id of FABRICANTE_IDS) {
  const expected = fab[id].orders.filter((o) => !o.paid && o.status !== "cancelado").reduce((s, o) => s + (o.monto || 0), 0);
  if (expected !== fab[id].balance) {
    anomalies.push({ nivel: "alta", texto: `Saldo de ${FABRICANTE_LABELS[id]} no cuadra: dice ${cop(fab[id].balance)} pero los pedidos pendientes suman ${cop(expected)}.` });
  }
}

// Gastos de "Publicidad" que no parecen pauta (mal categorizados o de prueba).
for (const e of expenses.filter((x) => x.category === "Publicidad")) {
  if (e.amount < 1000 || expensePlatform(e) === "otra") {
    anomalies.push({ nivel: "media", texto: `Gasto en "Publicidad" que no parece pauta: ${e.day} ${cop(e.amount)} "${e.description}". Si es material, va en "Insumos".` });
  }
}

// Inventario bajo (mismos umbrales que app/lib/inventory.js).
for (const [field, value] of Object.entries(stockRaw || {})) {
  const n = Number(value);
  const threshold = field === "soportes" ? 5 : 3;
  if (n <= threshold) anomalies.push({ nivel: n === 0 ? "alta" : "media", texto: `Inventario bajo: ${field} = ${n} (umbral ${threshold}).` });
}

const levelOrder = { alta: 0, media: 1, info: 2 };
anomalies.sort((a, b) => levelOrder[a.nivel] - levelOrder[b.nivel]);

// ---------- Salida ----------

const month = profitFor(inMonth);
const week = profitFor(inWeek);
const reporte1m = adminReporte1m();
const daySummary = summarize(dayOrders);
const monthSummary = summarize(monthOrders);
const weekSummary = summarize(weekOrders);
const allSummary = summarize(allOrders);

const data = {
  fecha: reportDay,
  generado: new Date().toISOString(),
  dia: daySummary,
  mes: { ...monthSummary, utilidad: month },
  semana: args.semana ? { desde: weekStart, ...weekSummary, utilidad: week } : undefined,
  historico: allSummary,
  adminReporte1m: reporte1m,
  contraentrega: { antes: codAntes, antes30: codAntes30, despues: codDespues },
  pedidosMes: monthOrders,
  pedidosHistorico: allOrders,
  pauta: adSpend,
  cris: FABRICANTE_IDS.map((id) => ({
    id,
    nombre: FABRICANTE_LABELS[id],
    saldo: fab[id].balance,
    pendientes: fab[id].orders.filter((o) => !o.paid && o.status !== "cancelado").length,
    ultimoPago: fab[id].payouts.at(-1) || null,
  })),
  inventario: stockRaw,
  anomalias: anomalies,
};

if (args.json) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

const L = [];
const mixText = (mix) =>
  Object.entries(mix)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ") || "—";

L.push(`# Finanzas Mystery — ${reportDay}`);
L.push("");
L.push(`_Generado ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })} con \`scripts/finanzas-resumen.mjs\` (solo lectura de Redis de producción). Excluye compras de prueba del dueño, referencias "test" y regalos de $0._`);
L.push("");

const top = anomalies.filter((a) => a.nivel === "alta");
L.push("## ⚠️ Lo primero");
L.push("");
if (top.length) for (const a of top) L.push(`- **${a.texto}**`);
else L.push("- Sin ventas con pérdida ni anomalías graves.");
L.push("");

L.push("## Hoy");
L.push("");
L.push(`- Pedidos: **${daySummary.count}** · Ventas: **${cop(daySummary.revenue)}** · Margen: ${cop(daySummary.margen)}`);
L.push("");

L.push(`## Mes (${monthPrefix}, hasta el ${reportDay.slice(8)})`);
L.push("");
L.push(`| | |`);
L.push(`|---|---|`);
L.push(`| Pedidos | ${monthSummary.count} |`);
L.push(`| Ventas | ${cop(monthSummary.revenue)} |`);
L.push(`| Ticket promedio | ${cop(monthSummary.ticket)} |`);
L.push(`| Mix de tamaños | ${mixText(monthSummary.mix)} |`);
L.push(`| Contraentrega / en línea | ${monthSummary.cod} / ${monthSummary.online} (${pct(monthSummary.cod, monthSummary.count)} contraentrega) |`);
L.push(`| Comisión Wompi | ${cop(month.wompi)} |`);
L.push(`| Fabricación (Cris, por guía creada) | ${cop(month.fabricacion)} |`);
L.push(`| Guías Skydropx | ${cop(month.envios)} |`);
L.push(`| Referidos pagados | ${cop(month.referidos)} |`);
L.push(`| Pauta | ${cop(month.publicidad)} |`);
L.push(`| Insumos y otros gastos manuales | ${cop(month.otrosGastos)} |`);
L.push(`| **Utilidad del mes** | **${cop(month.utilidad)}** |`);
L.push("");
L.push(`Para comparar con /admin/reporte ("Último mes", desde ${reporte1m.desde}, cuenta los pagos a Cris por fecha de pago): ${reporte1m.pedidos} pedidos, ventas ${cop(reporte1m.revenue)}, utilidad ${cop(reporte1m.utilidad)}.`);
L.push("");

if (args.semana) {
  L.push(`## Semana (${weekStart} a ${reportDay})`);
  L.push("");
  L.push(`- Pedidos: **${weekSummary.count}** · Ventas: **${cop(weekSummary.revenue)}** · Ticket: ${cop(weekSummary.ticket)} · Margen por pedidos: ${cop(weekSummary.margen)}`);
  L.push(`- Mix: ${mixText(weekSummary.mix)} · Contraentrega ${weekSummary.cod} / en línea ${weekSummary.online}`);
  L.push(`- Gastos de la semana: Wompi ${cop(week.wompi)}, Cris ${cop(week.fabricacion)}, guías ${cop(week.envios)}, pauta ${cop(week.publicidad)}, insumos/otros ${cop(week.otrosGastos)} → **utilidad ${cop(week.utilidad)}**`);
  L.push("");
}

L.push("## Margen real por pedido (mes)");
L.push("");
L.push(
  conMateriales
    ? "Margen = precio − comisión de Cris − guía − comisión Wompi − materiales por tamaño (reportes-internos/finanzas/config.json)."
    : "Margen = precio − comisión de Cris − guía − comisión Wompi. **No resta materiales** (madera, vinilo, soporte): esos se compran por lote y van en \"Insumos\"."
);
L.push("");
if (monthOrders.length) {
  L.push("| Fecha | Pedido | Cliente | Tamaño | Pago | Precio | Cris | Guía (tope) | Wompi | Margen |");
  L.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const o of monthOrders) {
    L.push(
      `| ${o.day} | ${shortRef(o.reference)} | ${o.cliente} | ${o.sizeId}${o.frameType ? ` ${o.frameType}` : ""} | ${o.paymentMethod} | ${cop(o.priceCOP)} | ${cop(o.comision)}${o.comisionEstimada ? "*" : ""} | ${o.guia == null ? "sin guía aún" : `${cop(o.guia)} ${o.carrier || ""}`} (${cop(o.tope)}) | ${cop(o.wompi)} | ${cop(o.margen)}${o.margenProvisional ? " (provisional)" : ""} |`
    );
  }
  if (monthOrders.some((o) => o.comisionEstimada)) {
    L.push("");
    L.push("\\* comisión estimada: todavía no hay guía, así que Cris aún no la tiene registrada.");
  }
} else {
  L.push("Sin pedidos este mes.");
}
L.push("");

L.push("## Contraentrega vs pago en línea (recargo de $5.000 desde el 23 oct)");
L.push("");
L.push(`- Histórico antes del recargo: ${codAntes.cod} de ${codAntes.total} pedidos reales fueron contraentrega (${pct(codAntes.cod, codAntes.total)}).`);
L.push(`- 30 días antes del recargo: ${codAntes30.cod} de ${codAntes30.total} (${pct(codAntes30.cod, codAntes30.total)}).`);
L.push(`- Desde el recargo: ${codDespues.cod} de ${codDespues.total} (${pct(codDespues.cod, codDespues.total)}).`);
L.push(codDespues.total < 10 ? "- Todavía muy pocos pedidos para concluir algo (hace falta al menos ~10 después del recargo)." : "");
L.push("");

L.push("## Pauta y CPA por canal");
L.push("");
const canalesConDato = allOrders.filter((o) => o.canal).length;
if (canalesConDato === 0) {
  L.push("- Los pedidos todavía **no guardan de qué canal vino el cliente** (eso lo agrega el PR \"origen de pedidos\", sin fusionar). Por ahora el CPA solo se puede calcular como pauta del período ÷ todas las ventas del período (incluye orgánicas, así que es optimista).");
} else {
  const byCanal = {};
  for (const o of monthOrders) byCanal[o.canal || "sin dato"] = (byCanal[o.canal || "sin dato"] || 0) + 1;
  L.push(`- Pedidos del mes por canal: ${Object.entries(byCanal).map(([k, v]) => `${k}: ${v}`).join(" · ")}`);
}
const monthAds = adSpend.filter((a) => inMonth(a.day));
const byPlat = {};
for (const a of monthAds) byPlat[a.plataforma || "sin plataforma"] = (byPlat[a.plataforma || "sin plataforma"] || 0) + a.monto;
L.push(`- Pauta registrada este mes: ${monthAds.length ? Object.entries(byPlat).map(([k, v]) => `${k} ${cop(v)}`).join(" · ") : "**ninguna**"}${pauta.length ? "" : " (no hay reportes-internos/finanzas/pauta.json)"}.`);
if (monthAds.length && monthSummary.count) {
  const totalAds = monthAds.reduce((s, a) => s + a.monto, 0);
  L.push(`- CPA mezclado del mes: ${cop(totalAds / monthSummary.count)} por venta (regla: escalar solo si < $25.000).`);
}
L.push("");

L.push("## Saldo de Cris");
L.push("");
for (const c of data.cris) {
  L.push(`- ${c.nombre}: **${cop(c.saldo)}** pendiente (${c.pendientes} pedidos). Último pago: ${c.ultimoPago ? `${cop(c.ultimoPago.amount)} el ${bogotaDay(c.ultimoPago.date)}` : "ninguno"}.`);
}
L.push("");

const rest = anomalies.filter((a) => a.nivel !== "alta");
if (rest.length) {
  L.push("## Otras observaciones");
  L.push("");
  for (const a of rest) L.push(`- ${a.nivel === "media" ? "🟡" : "ℹ️"} ${a.texto}`);
  L.push("");
}

L.push("## Histórico (todos los pedidos reales)");
L.push("");
L.push(`- ${allSummary.count} pedidos · ${cop(allSummary.revenue)} · ticket ${cop(allSummary.ticket)} · margen sumado ${cop(allSummary.margen)}`);
L.push(`- Mix: ${mixText(allSummary.mix)}`);
L.push("");

const md = L.filter((line, i, arr) => !(line === "" && arr[i - 1] === "")).join("\n");
console.log(md);
if (typeof args.out === "string") writeFileSync(args.out, md + "\n", "utf8");
