import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  GIFT_FEATURES_ENABLED,
  normalizeGiftMessage,
  normalizePersonName,
  toGiftOption,
  giftCardPriceCOP,
  isGiftCardReference,
  generateGiftCardCode,
  isValidEmail,
  verifyGiftCardTransaction,
} from "../app/lib/giftFeatures.js";
import { getPriceCOP } from "../app/lib/order.js";

test("apagado por defecto (sin NEXT_PUBLIC_GIFT_FEATURES)", () => {
  assert.equal(GIFT_FEATURES_ENABLED, process.env.NEXT_PUBLIC_GIFT_FEATURES === "1");
  if (!process.env.NEXT_PUBLIC_GIFT_FEATURES) assert.equal(GIFT_FEATURES_ENABLED, false);
});

test("mensaje de regalo: límite, control chars y líneas", () => {
  assert.equal(normalizeGiftMessage("  Hola\u0000 mamá  "), "Hola mamá");
  assert.equal(normalizeGiftMessage("a".repeat(500)).length, 200);
  assert.equal(normalizeGiftMessage("1\n2\n3\n4\n5\n6\n7\n8"), "1\n2\n3\n4\n5\n6");
  assert.equal(normalizeGiftMessage("a\n\n\nb"), "a\nb");
  assert.equal(normalizeGiftMessage(42), "");
});

test("nombre: sin < > ni saltos", () => {
  assert.equal(normalizePersonName("  Ana\n<b>Pérez</b> "), "Ana bPérez/b");
});

test("toGiftOption: null si no es regalo", () => {
  assert.equal(toGiftOption(null), null);
  assert.equal(toGiftOption({ enabled: "true", message: "x" }), null);
  assert.deepEqual(toGiftOption({ enabled: true, message: " Feliz día " }), { enabled: true, message: "Feliz día" });
});

test("precio de la tarjeta = 40x50 Premium vigente", () => {
  assert.equal(giftCardPriceCOP(), getPriceCOP("40x50", "premium"));
  assert.ok(giftCardPriceCOP() > 0);
});

test("referencias de tarjeta regalo", () => {
  assert.equal(isGiftCardReference("giftcard-1790000000000-a1b2c3"), true);
  assert.equal(isGiftCardReference("mystery-1790000000000"), false);
  assert.equal(isGiftCardReference("giftcard-1790000000000-a1b2c3x"), false);
});

test("código fuerte TARJETA-XXXX-XXXX sin caracteres ambiguos", () => {
  for (let i = 0; i < 200; i++) {
    const code = generateGiftCardCode(crypto.randomBytes);
    assert.match(code, /^TARJETA-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  }
  const fixed = generateGiftCardCode(() => Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
  assert.equal(fixed, "TARJETA-2345-6789");
});

test("emails", () => {
  assert.equal(isValidEmail("ana@x.co"), true);
  assert.equal(isValidEmail("ana@x"), false);
  assert.equal(isValidEmail("<a>@x.co"), false);
});

test("verificación del pago: estado, referencia, moneda y monto exactos", () => {
  const purchase = { reference: "giftcard-1790000000000-a1b2c3", amountInCents: 8900000 };
  const tx = { id: "t1", status: "APPROVED", reference: purchase.reference, currency: "COP", amount_in_cents: 8900000 };
  assert.deepEqual(verifyGiftCardTransaction(tx, purchase), { ok: true });
  assert.equal(verifyGiftCardTransaction({ ...tx, status: "PENDING" }, purchase).reason, "not-approved");
  assert.equal(verifyGiftCardTransaction({ ...tx, amount_in_cents: 100 }, purchase).reason, "amount");
  assert.equal(verifyGiftCardTransaction({ ...tx, currency: "USD" }, purchase).reason, "currency");
  assert.equal(verifyGiftCardTransaction({ ...tx, reference: "giftcard-1-x" }, purchase).reason, "reference");
  assert.equal(verifyGiftCardTransaction(tx, null).reason, "missing");
});
