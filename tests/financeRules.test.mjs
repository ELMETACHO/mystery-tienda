import { test } from "node:test";
import assert from "node:assert/strict";
import {
  expensePlatform,
  isTestOrder,
  orderAdPlatform,
  orderMargin,
  platformFromText,
  wompiFeeForOrder,
} from "../app/lib/financeRules.js";

const EMAILS = ["dueno@example.com"];

test("compras de prueba: referencia test, valor $0 o correo de prueba", () => {
  assert.equal(isTestOrder({ reference: "mystery-regalo-test-1", priceCOP: 89000 }, EMAILS), true);
  assert.equal(isTestOrder({ reference: "mystery-1", priceCOP: 0 }, EMAILS), true);
  assert.equal(
    isTestOrder({ reference: "mystery-1", priceCOP: 65000, customerEmail: " Dueno@Example.com " }, EMAILS),
    true
  );
  assert.equal(
    isTestOrder({ reference: "mystery-1", priceCOP: 65000, customerEmail: "cliente@example.com" }, EMAILS),
    false
  );
});

test("Wompi: en contraentrega solo cobra comisión sobre el anticipo", () => {
  const online = wompiFeeForOrder({ paymentMethod: "wompi", priceCOP: 65000 });
  assert.equal(Math.round(online), Math.round((65000 * 0.0265 + 700) * 1.19));
  const cod = wompiFeeForOrder({ paymentMethod: "cod", priceCOP: 320000 });
  assert.equal(Math.round(cod), Math.round((20000 * 0.0265 + 700) * 1.19));
});

test("plataforma de pauta: campo guardado primero, si no por la descripción", () => {
  assert.equal(expensePlatform({ platform: "meta", description: "tiktok" }), "meta");
  assert.equal(expensePlatform({ description: "Publicidad en tiktok ads" }), "tiktok");
  assert.equal(expensePlatform({ description: "saldo para anuncios en Google Ads" }), "google");
  assert.equal(expensePlatform({ description: "Compra de 30 cuadros" }), "otra");
  assert.equal(platformFromText("Anuncio Instagram"), "meta");
});

test("canal del pedido → plataforma de pauta (orgánico = null)", () => {
  assert.equal(orderAdPlatform({ attribution: { channel: "tiktok_ads" } }), "tiktok");
  assert.equal(orderAdPlatform({ attribution: { channel: "instagram_ads" } }), "meta");
  assert.equal(orderAdPlatform({ attribution: { channel: "tiktok_organico" } }), null);
  assert.equal(orderAdPlatform({}), null);
});

test("margen: precio − fabricante − guía − Wompi − materiales", () => {
  const order = { sizeLabel: "30 x 40 cm", paymentMethod: "wompi", priceCOP: 65000 };
  const fab = { monto: 15000, shippingCostCOP: 8799 };
  const m = orderMargin(order, fab, { "30x40": 21000 });
  assert.equal(m.sizeId, "30x40");
  assert.equal(m.provisional, false);
  assert.equal(Math.round(m.margin), Math.round(65000 - 15000 - 8799 - m.wompi - 21000));

  const sinGuia = orderMargin(order, null);
  assert.equal(sinGuia.commissionEstimated, true);
  assert.equal(sinGuia.commission, 15000);
  assert.equal(sinGuia.shipping, null);
  assert.equal(sinGuia.provisional, true);
});
