import { test } from "node:test";
import assert from "node:assert/strict";
import { SIZES, PRICES, COD_DEPOSIT_COP, getPriceCOP } from "../app/lib/order.js";
import { checkFullPaymentIntegrity, checkCodPaymentIntegrity } from "../app/lib/paymentIntegrity.js";

// Mismo cálculo que /api/wompi-signature (resolveAmountInCents).
const discounted = (base, percent) => (percent > 0 ? Math.round(base * (1 - percent / 100)) : base);
const tx = (cop, extra = {}) => ({ id: "t1", reference: "mystery-1", status: "APPROVED", amount_in_cents: cop * 100, currency: "COP", ...extra });

const legitCombos = [];
for (const size of SIZES) {
  for (const frameType of Object.keys(PRICES)) {
    if (size.premiumOnly && frameType !== "premium") continue;
    if (PRICES[frameType][size.id] == null) continue;
    for (const percent of [0, 5, 10]) legitCombos.push({ size, frameType, percent });
  }
}

test("todo pago completo legítimo (lista, referido 5%, MYSTERY10 10%) pasa", () => {
  assert.ok(legitCombos.length > 10);
  for (const { size, frameType, percent } of legitCombos) {
    const price = discounted(getPriceCOP(size.id, frameType), percent);
    const order = { sizeId: size.id, frameType, priceCOP: price };
    const r = checkFullPaymentIntegrity({ order, transaction: tx(price) });
    assert.equal(r.ok, true, `${size.id} ${frameType} ${percent}% → ${r.problems}`);
  }
});

test("pedido sin frameType usa premium por defecto (igual que wompi-signature)", () => {
  const order = { sizeId: "40x50", priceCOP: 89000 };
  assert.equal(checkFullPaymentIntegrity({ order, transaction: tx(89000) }).ok, true);
});

test("pagar de más nunca se marca", () => {
  const order = { sizeId: "30x40", frameType: "tradicional", priceCOP: 55000 };
  assert.equal(checkFullPaymentIntegrity({ order, transaction: tx(89000) }).ok, true);
});

test("anticipo COD de $20.000 usado como pago completo se marca", () => {
  const order = { sizeId: "100x140", frameType: "premium", priceCOP: 350000 };
  const r = checkFullPaymentIntegrity({ order, transaction: tx(COD_DEPOSIT_COP) });
  assert.equal(r.ok, false);
});

test("pagar un 30x40 y pedir un 70x100 se marca", () => {
  const order = { sizeId: "70x100", frameType: "premium", priceCOP: 249000 };
  assert.equal(checkFullPaymentIntegrity({ order, transaction: tx(65000) }).ok, false);
});

test("moneda distinta de COP, monto ausente o tamaño desconocido se marcan", () => {
  const order = { sizeId: "40x50", frameType: "premium", priceCOP: 89000 };
  assert.equal(checkFullPaymentIntegrity({ order, transaction: tx(89000, { currency: "USD" }) }).ok, false);
  assert.equal(checkFullPaymentIntegrity({ order, transaction: { id: "t", status: "APPROVED" } }).ok, false);
  assert.equal(checkFullPaymentIntegrity({ order: { sizeId: "1x1" }, transaction: tx(999999) }).ok, false);
  assert.equal(checkFullPaymentIntegrity({ order: null, transaction: tx(999999) }).ok, false);
});

test("toda contraentrega legítima pasa (priceCOP con o sin descuento)", () => {
  for (const { size, frameType, percent } of legitCombos) {
    const price = discounted(getPriceCOP(size.id, frameType), percent);
    const order = { sizeId: size.id, frameType, priceCOP: price };
    const r = checkCodPaymentIntegrity({ order, transaction: tx(COD_DEPOSIT_COP) });
    assert.equal(r.ok, true, `${size.id} ${frameType} ${percent}% → ${r.problems}`);
  }
});

test("contraentrega con priceCOP manipulado (saldo 0) o anticipo menor se marca", () => {
  const order = { sizeId: "100x140", frameType: "premium", priceCOP: COD_DEPOSIT_COP };
  assert.equal(checkCodPaymentIntegrity({ order, transaction: tx(COD_DEPOSIT_COP) }).ok, false);
  const ok = { sizeId: "40x50", frameType: "premium", priceCOP: 89000 };
  assert.equal(checkCodPaymentIntegrity({ order: ok, transaction: tx(1000) }).ok, false);
  assert.equal(checkCodPaymentIntegrity({ order: { ...ok, priceCOP: "abc" }, transaction: tx(COD_DEPOSIT_COP) }).ok, false);
});
