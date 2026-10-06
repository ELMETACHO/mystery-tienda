import { SIZES, COD_DEPOSIT_COP, DEFAULT_FRAME_TYPE, getPriceCOP } from "./order";

// Verificación server-side de que lo que Wompi cobró corresponde al pedido
// que se va a fabricar. Antes, /api/confirm-order, /api/confirm-cod-order,
// el webhook y el cron de conciliación solo miraban transaction.status ===
// "APPROVED"; el `order` (tamaño, marco, priceCOP) llega del navegador o
// del pending-order que el mismo navegador guardó. Eso permitía, p.ej.:
//   - pagar el anticipo de contraentrega ($20.000) y confirmar esa misma
//     transacción en /api/confirm-order como pago COMPLETO (saldo 0) de un
//     cuadro de $350.000;
//   - pagar un 30x40 y mandar un pedido 100x140;
//   - en contraentrega, mandar order.priceCOP = 20000 → saldo a cobrar 0.
//
// Regla deliberadamente tolerante para no frenar NUNCA un pago legítimo:
// el mínimo aceptado es el precio de lista del tamaño/marco con el MAYOR
// descuento que existe para pagos con Wompi (MYSTERY10 = 10%; referidos =
// 5%). Los códigos de regalo (100%) solo pasan por /api/confirm-free-order,
// que no usa esta verificación. Pagar de más nunca se marca.
export const MAX_PAID_DISCOUNT_PERCENT = 10;

function minimumLegitPriceCOP(order) {
  const size = SIZES.find((s) => s.id === order?.sizeId);
  if (!size) return null;
  const frameType = order?.frameType || DEFAULT_FRAME_TYPE;
  const basePriceCOP = getPriceCOP(size.id, frameType);
  if (!Number.isFinite(basePriceCOP)) return null;
  return Math.round(basePriceCOP * (1 - MAX_PAID_DISCOUNT_PERCENT / 100));
}

function checkCurrency(transaction, problems) {
  // Wompi Colombia solo cobra en COP; si no viene el campo (respuestas
  // viejas/parciales) no se marca por eso.
  if (transaction?.currency && transaction.currency !== "COP") {
    problems.push(`Moneda inesperada: ${transaction.currency}`);
  }
}

function amountPaidCOP(transaction) {
  const cents = Number(transaction?.amount_in_cents);
  return Number.isFinite(cents) ? cents / 100 : null;
}

// Pago completo (paymentMethod "wompi").
export function checkFullPaymentIntegrity({ order, transaction }) {
  const problems = [];
  checkCurrency(transaction, problems);

  const paid = amountPaidCOP(transaction);
  const minimum = minimumLegitPriceCOP(order);

  if (paid === null) {
    problems.push("La transacción no trae amount_in_cents");
  }
  if (minimum === null) {
    problems.push(`Tamaño desconocido en el pedido: ${order?.sizeId}`);
  }
  if (paid !== null && minimum !== null && paid < minimum) {
    problems.push(
      `Monto pagado $${paid} menor al mínimo posible $${minimum} para ${order?.sizeId} ${order?.frameType || DEFAULT_FRAME_TYPE}`
    );
  }

  return { ok: problems.length === 0, problems, paidCOP: paid, minimumCOP: minimum };
}

// Contraentrega (paymentMethod "cod"): el anticipo debe ser de al menos
// COD_DEPOSIT_COP y el priceCOP del pedido (del que sale el saldo que
// cobra la transportadora) no puede ser menor al mínimo legítimo.
export function checkCodPaymentIntegrity({ order, transaction }) {
  const problems = [];
  checkCurrency(transaction, problems);

  const paid = amountPaidCOP(transaction);
  const minimum = minimumLegitPriceCOP(order);
  const declaredPrice = Number(order?.priceCOP);

  if (paid === null) {
    problems.push("La transacción no trae amount_in_cents");
  } else if (paid < COD_DEPOSIT_COP) {
    problems.push(`Anticipo pagado $${paid} menor a $${COD_DEPOSIT_COP}`);
  }
  if (minimum === null) {
    problems.push(`Tamaño desconocido en el pedido: ${order?.sizeId}`);
  } else if (!Number.isFinite(declaredPrice) || declaredPrice < minimum) {
    problems.push(
      `priceCOP del pedido ($${order?.priceCOP}) menor al mínimo posible $${minimum} para ${order?.sizeId} ${order?.frameType || DEFAULT_FRAME_TYPE}`
    );
  }

  return { ok: problems.length === 0, problems, paidCOP: paid, minimumCOP: minimum };
}
