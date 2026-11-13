import { COD_DEPOSIT_COP, getFabricanteCommissionCOP } from "./order";

// Reglas puras del reporte financiero (sin Redis): las usan
// app/lib/financeReport.js (/admin/reporte) y
// scripts/finanzas-resumen.mjs (reporte diario), para que los dos den
// exactamente los mismos números.

// Comisión real de Wompi en Colombia para tarjetas: 2.65% + $700 COP
// fijos, más IVA (19%) SOLO sobre esa comisión (no sobre el total de la
// venta) — se calcula al vuelo a partir del monto que REALMENTE pasó por
// Wompi en vez de guardarla pedido por pedido, porque la fórmula no
// cambia. Para pedidos "cod" eso es el anticipo fijo (COD_DEPOSIT_COP),
// NUNCA el priceCOP completo — el resto lo cobra la transportadora en
// efectivo al entregar, nunca pasa por Wompi.
const WOMPI_PERCENT_FEE = 0.0265;
const WOMPI_FIXED_FEE_COP = 700;
const WOMPI_IVA_RATE = 0.19;
export function wompiFeeForOrder(order) {
  const chargedAmount = order.paymentMethod === "cod" ? COD_DEPOSIT_COP : order.priceCOP;
  const baseFee = chargedAmount * WOMPI_PERCENT_FEE + WOMPI_FIXED_FEE_COP;
  return baseFee * (1 + WOMPI_IVA_RATE);
}

// Compras de prueba del dueño: no son ventas reales y antes inflaban los
// ingresos de /admin/reporte (sept 2026: $295.000 de pruebas contadas como
// venta). Se excluyen por referencia "test", valor $0 (regalos) o correo
// de prueba. FINANZAS_EMAILS_PRUEBA (separados por coma) reemplaza la lista.
const DEFAULT_TEST_EMAILS = "oscarmetacho@gmail.com";
function testEmails() {
  return (process.env.FINANZAS_EMAILS_PRUEBA || DEFAULT_TEST_EMAILS)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
export function isTestOrder(order, emails = testEmails()) {
  return (
    /test/i.test(order.reference || "") ||
    !(order.priceCOP > 0) ||
    emails.includes(String(order.customerEmail || "").trim().toLowerCase())
  );
}

// Plataformas de pauta. Los gastos "Publicidad" nuevos guardan `platform`;
// los viejos (antes de oct 2026) se clasifican por la descripción.
export const AD_PLATFORMS = ["tiktok", "meta", "google", "otra"];
export const AD_PLATFORM_LABELS = {
  tiktok: "TikTok",
  meta: "Meta (Facebook/Instagram)",
  google: "Google",
  otra: "Otra / sin plataforma",
};
export function platformFromText(text) {
  const t = String(text || "").toLowerCase();
  if (/tik ?tok/.test(t)) return "tiktok";
  if (/meta|facebook|instagram|\bfb\b|\big\b/.test(t)) return "meta";
  if (/google/.test(t)) return "google";
  return null;
}
export function expensePlatform(expense) {
  if (AD_PLATFORMS.includes(expense.platform)) return expense.platform;
  return platformFromText(expense.description) || "otra";
}

// Canal de origen del pedido (order.attribution, ver PR "origen de
// pedidos") → plataforma de pauta que lo trajo. null = orgánico o sin dato.
const PAID_CHANNEL_PLATFORM = {
  tiktok_ads: "tiktok",
  facebook_ads: "meta",
  instagram_ads: "meta",
  google_ads: "google",
};
export function orderChannel(order) {
  return order.attribution?.channel || null;
}
export function orderAdPlatform(order) {
  return PAID_CHANNEL_PLATFORM[orderChannel(order)] || null;
}

// Margen de un pedido = precio − comisión del fabricante − guía − Wompi −
// materiales (si hay costo configurado para su tamaño). `fabRecord` es el
// registro de fabricante:<id>:orders (null si aún no hay guía: la comisión
// se estima y la guía queda pendiente).
export function sizeIdFromLabel(label) {
  return String(label || "").replace(/\s|cm/g, "");
}
export function orderMargin(order, fabRecord, materialsBySize = {}) {
  const sizeId = sizeIdFromLabel(order.sizeLabel);
  const commission = fabRecord
    ? fabRecord.monto
    : getFabricanteCommissionCOP("premium", sizeId);
  const shipping = fabRecord?.shippingCostCOP ?? null;
  const wompi = wompiFeeForOrder(order);
  const materials = Number(materialsBySize[sizeId]) || 0;
  return {
    sizeId,
    commission,
    commissionEstimated: !fabRecord,
    shipping,
    wompi,
    materials,
    margin: order.priceCOP - commission - (shipping ?? 0) - wompi - materials,
    provisional: shipping == null,
  };
}
