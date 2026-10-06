import { isColombianHoliday } from "./colombiaHolidays";

// Fecha estimada de entrega ("Llega entre el … y el …") — SOLO texto para
// mostrar en /producto, /crear, /ads y /checkout. No cambia nada del
// pedido, del pago ni de la guía.
//
// Datos del dueño (oct 2026): producción 1-2 días + tránsito, máximo 5
// días hasta el cliente, la transportadora no entrega los domingos. Se
// cuentan días hábiles = lunes a sábado que no sean festivo nacional
// (app/lib/colombiaHolidays.js), empezando el día SIGUIENTE al pedido:
//   - mínimo: 1 día de producción + 1 de tránsito = 2.º día hábil.
//   - máximo: 5.º día hábil (tope que promete la tienda).
// Mismos números que el JSON-LD del producto (handlingTime 1-2,
// transitTime 1-3) y el feed de Merchant Center.
export const DELIVERY_MIN_BUSINESS_DAYS = 2;
export const DELIVERY_MAX_BUSINESS_DAYS = 5;

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

// Colombia es UTC-5 todo el año (sin horario de verano).
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

// "AAAA-MM-DD" de hoy en Bogotá, sin importar la zona horaria del
// navegador o del servidor.
export function todayInBogota(now = Date.now()) {
  return new Date(Number(now) - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

function isoToUtc(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function utcToIso(date) {
  return date.toISOString().slice(0, 10);
}

export function isDeliveryBusinessDay(iso) {
  return isoToUtc(iso).getUTCDay() !== 0 && !isColombianHoliday(iso);
}

// n.º día hábil DESPUÉS de `fromIso` (el propio día no cuenta).
export function addBusinessDays(fromIso, n) {
  let date = isoToUtc(fromIso);
  let counted = 0;
  // Tope de seguridad: nunca más de 60 vueltas aunque algo raro pase.
  for (let i = 0; i < 60 && counted < n; i++) {
    date = new Date(date.getTime() + 86400000);
    if (isDeliveryBusinessDay(utcToIso(date))) counted += 1;
  }
  return utcToIso(date);
}

export function getDeliveryEstimate(now = Date.now()) {
  const today = todayInBogota(now);
  return {
    today,
    from: addBusinessDays(today, DELIVERY_MIN_BUSINESS_DAYS),
    to: addBusinessDays(today, DELIVERY_MAX_BUSINESS_DAYS),
  };
}

function parts(iso) {
  const date = isoToUtc(iso);
  return {
    weekday: WEEKDAYS[date.getUTCDay()],
    day: date.getUTCDate(),
    month: MONTHS[date.getUTCMonth()],
    year: date.getUTCFullYear(),
  };
}

// "Llega entre el jueves 8 y el martes 13 de octubre"
// "Llega entre el lunes 30 de noviembre y el viernes 4 de diciembre"
export function formatDeliveryRange({ from, to }) {
  const a = parts(from);
  const b = parts(to);
  const first = a.month === b.month ? `${a.weekday} ${a.day}` : `${a.weekday} ${a.day} de ${a.month}`;
  return `Llega entre el ${first} y el ${b.weekday} ${b.day} de ${b.month}`;
}
