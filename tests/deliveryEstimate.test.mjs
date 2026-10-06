import { test } from "node:test";
import assert from "node:assert/strict";
import { COLOMBIA_HOLIDAYS, computeColombianHolidays, isColombianHoliday } from "../app/lib/colombiaHolidays.js";
import {
  addBusinessDays,
  formatDeliveryRange,
  getDeliveryEstimate,
  todayInBogota,
} from "../app/lib/deliveryEstimate.js";

test("la lista escrita a mano de 2026 y 2027 coincide con el cálculo (Pascua + Ley Emiliani)", () => {
  for (const year of [2026, 2027]) {
    assert.deepEqual(computeColombianHolidays(year), [...COLOMBIA_HOLIDAYS[year]].sort());
    assert.equal(COLOMBIA_HOLIDAYS[year].length, 19);
  }
});

test("festivos trasladados por Ley Emiliani", () => {
  assert.ok(isColombianHoliday("2026-11-02")); // Todos los Santos (1 nov cae domingo)
  assert.ok(!isColombianHoliday("2026-11-01"));
  assert.ok(isColombianHoliday("2026-07-13")); // Chiquinquirá (Ley 2578)
  assert.ok(isColombianHoliday("2027-10-18")); // Día de la Raza
  assert.ok(!isColombianHoliday("2027-10-12"));
});

test("hoy en Bogotá usa UTC-5 (11 p. m. en Bogotá ya es mañana en UTC)", () => {
  // 2026-10-06T03:30Z = 5 oct 22:30 en Bogotá
  assert.equal(todayInBogota(Date.parse("2026-10-06T03:30:00Z")), "2026-10-05");
  assert.equal(todayInBogota(Date.parse("2026-10-06T05:00:00Z")), "2026-10-06");
});

test("salta domingos y festivos", () => {
  // Viernes 9 oct 2026: sáb 10 (1), [dom 11], [lun 12 festivo], mar 13 (2)
  assert.equal(addBusinessDays("2026-10-09", 2), "2026-10-13");
  // … mié 14 (3), jue 15 (4), vie 16 (5)
  assert.equal(addBusinessDays("2026-10-09", 5), "2026-10-16");
});

test("rango para un lunes normal: miércoles a sábado", () => {
  const est = getDeliveryEstimate(Date.parse("2026-10-05T15:00:00Z")); // lun 5 oct
  assert.deepEqual(est, { today: "2026-10-05", from: "2026-10-07", to: "2026-10-10" });
  assert.equal(formatDeliveryRange(est), "Llega entre el miércoles 7 y el sábado 10 de octubre");
});

test("pedido un domingo empieza a contar el lunes", () => {
  const est = getDeliveryEstimate(Date.parse("2026-10-18T15:00:00Z")); // dom 18 oct
  assert.equal(est.from, "2026-10-20");
  assert.equal(est.to, "2026-10-23");
});

test("rango que cruza de mes", () => {
  const est = getDeliveryEstimate(Date.parse("2026-11-27T15:00:00Z")); // vie 27 nov
  // sáb 28 (1), lun 30 (2), mar 1 (3), mié 2 (4), jue 3 (5)
  assert.equal(formatDeliveryRange(est), "Llega entre el lunes 30 de noviembre y el jueves 3 de diciembre");
});

test("Navidad: un pedido del 17 dic llega a más tardar el 23 dic", () => {
  const est = getDeliveryEstimate(Date.parse("2026-12-17T15:00:00Z")); // jue 17 dic
  // vie 18, sáb 19, lun 21, mar 22, mié 23
  assert.equal(est.to, "2026-12-23");
});
