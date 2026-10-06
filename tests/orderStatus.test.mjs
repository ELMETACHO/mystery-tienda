import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhoneInput, normalizeReference, phoneMatches, toPublicStatus } from "../app/lib/orderStatus.js";

test("referencia: solo letras, números y guiones", () => {
  assert.equal(normalizeReference(" mystery-1789530352469 "), "mystery-1789530352469");
  assert.equal(normalizeReference("mystery-cod-1790031223089"), "mystery-cod-1790031223089");
  assert.equal(normalizeReference("manual-shipment:*"), null);
  assert.equal(normalizeReference("abc"), null);
  assert.equal(normalizeReference("<script>"), null);
});

test("celular: 4 dígitos o completo; otros largos no", () => {
  assert.deepEqual(normalizePhoneInput("6716"), { kind: "last4", value: "6716" });
  assert.deepEqual(normalizePhoneInput("+57 320 264 6716"), { kind: "full", value: "3202646716" });
  assert.equal(normalizePhoneInput("67"), null);
  assert.equal(normalizePhoneInput("646716"), null);
});

test("coincidencia de celular", () => {
  assert.ok(phoneMatches("3202646716", normalizePhoneInput("6716")));
  assert.ok(phoneMatches("3202646716", normalizePhoneInput("573202646716")));
  assert.ok(!phoneMatches("3202646716", normalizePhoneInput("6715")));
  assert.ok(!phoneMatches("3202646716", normalizePhoneInput("3202646715")));
  assert.ok(!phoneMatches("", normalizePhoneInput("6716")));
});

const base = {
  reference: "mystery-1",
  order: { sizeLabel: "40 x 50 cm", frameType: "premium" },
  customer: { fullName: "Ana Pérez", phone: "3001234567", email: "ana@x.co", street: "Calle 1", city: "Bogotá" },
  paymentMethod: "wompi",
  saldoPendiente: 0,
  status: "pending",
  trackingNumber: null,
  labelUrl: "https://skydropx/label.pdf",
  trackingUrl: null,
  savedAt: "2026-10-05T15:00:00.000Z",
};

test("nunca expone datos personales ni el PDF de la guía", () => {
  const out = JSON.stringify(toPublicStatus({ ...base, status: "generated", trackingNumber: "123", trackingUrl: "https://t.co/x", carrierName: "Envía" }));
  for (const secret of ["Ana", "3001234567", "ana@x.co", "Calle 1", "Bogotá", "label.pdf"]) {
    assert.ok(!out.includes(secret), `filtró ${secret}`);
  }
});

test("etapas", () => {
  assert.equal(toPublicStatus(base).stage, "produccion");
  assert.equal(toPublicStatus(base).trackingNumber, null);
  const shipped = toPublicStatus({ ...base, status: "generated", trackingNumber: "014", carrierName: "Envía", trackingUrl: "javascript:alert(1)" });
  assert.equal(shipped.stage, "despachado");
  assert.equal(shipped.trackingNumber, "014");
  assert.equal(shipped.trackingUrl, null); // solo http(s)
  assert.equal(toPublicStatus({ ...base, status: "no_coverage" }).stage, "sin_cobertura");
  // lun 5 oct → mié 7 a sáb 10
  assert.equal(toPublicStatus(base).estimatedFrom, "2026-10-07");
  assert.equal(toPublicStatus(base).estimatedTo, "2026-10-10");
});
