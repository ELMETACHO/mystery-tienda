import { test } from "node:test";
import assert from "node:assert/strict";
import { dueOccurrence, normalizeReminderInput } from "../app/lib/dateReminders.js";

const base = { occasion: "cumpleanos", month: 12, day: 24, createdAt: "2026-10-25T15:00:00Z", lastSentFor: null };

test("no avisa para la fecha del regalo que acaba de comprar", () => {
  assert.equal(dueOccurrence(base, "2026-12-10"), null);
  assert.equal(dueOccurrence(base, "2026-12-24"), null);
});

test("avisa 14 días antes de la misma fecha el año siguiente", () => {
  assert.equal(dueOccurrence(base, "2027-12-09"), null);
  assert.equal(dueOccurrence(base, "2027-12-10"), "2027-12-24");
  // Si el cron falló un día, todavía lo manda dentro de la ventana.
  assert.equal(dueOccurrence(base, "2027-12-15"), "2027-12-24");
  assert.equal(dueOccurrence(base, "2027-12-25"), null);
});

test("no repite el aviso de una ocurrencia ya enviada", () => {
  assert.equal(dueOccurrence({ ...base, lastSentFor: "2027-12-24" }, "2027-12-12"), null);
  assert.equal(dueOccurrence({ ...base, lastSentFor: "2027-12-24" }, "2028-12-10"), "2028-12-24");
});

test("fecha que ya pasó al comprar (regalo atrasado) avisa el año siguiente", () => {
  const r = { ...base, month: 10, day: 20 };
  assert.equal(dueOccurrence(r, "2027-10-06"), "2027-10-20");
});

test("cambio de año: aviso a fin de diciembre para una fecha de enero", () => {
  const r = { ...base, month: 1, day: 5 };
  assert.equal(dueOccurrence(r, "2026-12-25"), null); // es la fecha de este regalo
  assert.equal(dueOccurrence(r, "2027-12-23"), "2028-01-05");
});

test("29 de febrero en año no bisiesto cae el 28", () => {
  const r = { ...base, month: 2, day: 29, createdAt: "2026-01-01T00:00:00Z" };
  assert.equal(dueOccurrence(r, "2027-02-14"), "2027-02-28");
});

test("normaliza y valida lo que llega del navegador", () => {
  assert.deepEqual(normalizeReminderInput({ occasion: "madre", month: "5", day: "10", forName: " Mamá<script> " }), {
    occasion: "madre",
    month: 5,
    day: 10,
    forName: "Mamáscript",
  });
  assert.equal(normalizeReminderInput({ occasion: "x", month: 5, day: 10 }), null);
  assert.equal(normalizeReminderInput({ occasion: "madre", month: 2, day: 30 }), null);
  assert.equal(normalizeReminderInput({ occasion: "madre", month: 13, day: 1 }), null);
});
