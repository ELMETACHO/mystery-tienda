// Festivos nacionales de Colombia (días en que la transportadora no
// entrega ni se cuenta como día hábil de producción). Lo usa el cálculo de
// fecha estimada de entrega (app/lib/deliveryEstimate.js) — solo para
// MOSTRAR una fecha aproximada, nunca para lógica de pedidos o pagos.
//
// Fuentes:
//  - Ley 51 de 1983 ("Ley Emiliani"): lista de festivos y regla de
//    traslado al lunes siguiente.
//    https://www.icbf.gov.co/cargues/avance/compilacion/docs/ley_0051_1983.htm
//  - Ley 2578 del 1 de junio de 2026: agrega el Día de Nuestra Señora del
//    Rosario de Chiquinquirá (9 de julio), también trasladable por la Ley
//    51 de 1983 (en 2026 se disfrutó el lunes 13 de julio).
//    https://www.mininterior.gov.co/noticias/gobierno-sanciona-ley-que-convierte-el-9-de-julio-en-nuevo-festivo-nacional/
//  - Listas 2026-2027 contrastadas con https://www.festivos.com.co/ y
//    https://es.wikipedia.org/wiki/Anexo:D%C3%ADas_festivos_en_Colombia
//
// 2026 y 2027 van escritos a mano (fáciles de auditar). Para cualquier
// otro año se calculan con las mismas reglas (Pascua + Ley Emiliani); el
// test tests/deliveryEstimate.test.mjs verifica que el cálculo coincide
// con la lista escrita. Si el Congreso agrega o cambia un festivo,
// actualizar la lista Y la función computeColombianHolidays.

export const COLOMBIA_HOLIDAYS = {
  2026: [
    "2026-01-01", // Año Nuevo
    "2026-01-12", // Reyes Magos (6 ene → lunes)
    "2026-03-23", // San José (19 mar → lunes)
    "2026-04-02", // Jueves Santo
    "2026-04-03", // Viernes Santo
    "2026-05-01", // Día del Trabajo
    "2026-05-18", // Ascensión (→ lunes)
    "2026-06-08", // Corpus Christi (→ lunes)
    "2026-06-15", // Sagrado Corazón (→ lunes)
    "2026-06-29", // San Pedro y San Pablo
    "2026-07-13", // Virgen de Chiquinquirá (9 jul → lunes, Ley 2578 de 2026)
    "2026-07-20", // Independencia
    "2026-08-07", // Batalla de Boyacá
    "2026-08-17", // Asunción (15 ago → lunes)
    "2026-10-12", // Día de la Raza
    "2026-11-02", // Todos los Santos (1 nov → lunes)
    "2026-11-16", // Independencia de Cartagena (11 nov → lunes)
    "2026-12-08", // Inmaculada Concepción
    "2026-12-25", // Navidad
  ],
  2027: [
    "2027-01-01", // Año Nuevo
    "2027-01-11", // Reyes Magos (6 ene → lunes)
    "2027-03-22", // San José (19 mar → lunes)
    "2027-03-25", // Jueves Santo
    "2027-03-26", // Viernes Santo
    "2027-05-01", // Día del Trabajo (sábado)
    "2027-05-10", // Ascensión (→ lunes)
    "2027-05-31", // Corpus Christi (→ lunes)
    "2027-06-07", // Sagrado Corazón (→ lunes)
    "2027-07-05", // San Pedro y San Pablo (29 jun → lunes)
    "2027-07-12", // Virgen de Chiquinquirá (9 jul → lunes)
    "2027-07-20", // Independencia
    "2027-08-07", // Batalla de Boyacá (sábado)
    "2027-08-16", // Asunción (15 ago → lunes)
    "2027-10-18", // Día de la Raza (12 oct → lunes)
    "2027-11-01", // Todos los Santos
    "2027-11-15", // Independencia de Cartagena (11 nov → lunes)
    "2027-12-08", // Inmaculada Concepción
    "2027-12-25", // Navidad (sábado)
  ],
};

// ── Cálculo genérico (respaldo para años fuera de la lista) ────────────

function toIso(date) {
  return date.toISOString().slice(0, 10);
}

function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysUtc(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

// Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano).
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

// Ley Emiliani: si no cae lunes, se traslada al lunes siguiente.
function nextMonday(date) {
  const dow = date.getUTCDay(); // 0 = domingo
  const offset = (8 - dow) % 7;
  return addDaysUtc(date, offset);
}

export function computeColombianHolidays(year) {
  const easter = easterSunday(year);
  const fixed = [
    utcDate(year, 1, 1),
    utcDate(year, 5, 1),
    utcDate(year, 7, 20),
    utcDate(year, 8, 7),
    utcDate(year, 12, 8),
    utcDate(year, 12, 25),
    addDaysUtc(easter, -3), // Jueves Santo
    addDaysUtc(easter, -2), // Viernes Santo
  ];
  const moved = [
    utcDate(year, 1, 6),
    utcDate(year, 3, 19),
    utcDate(year, 6, 29),
    utcDate(year, 8, 15),
    utcDate(year, 10, 12),
    utcDate(year, 11, 1),
    utcDate(year, 11, 11),
    addDaysUtc(easter, 39), // Ascensión
    addDaysUtc(easter, 60), // Corpus Christi
    addDaysUtc(easter, 68), // Sagrado Corazón
  ].map(nextMonday);
  // Virgen de Chiquinquirá: festivo desde la Ley 2578 de 2026.
  if (year >= 2026) moved.push(nextMonday(utcDate(year, 7, 9)));

  return [...new Set([...fixed, ...moved].map(toIso))].sort();
}

const cache = new Map();

export function getColombianHolidays(year) {
  if (COLOMBIA_HOLIDAYS[year]) return COLOMBIA_HOLIDAYS[year];
  if (!cache.has(year)) cache.set(year, computeColombianHolidays(year));
  return cache.get(year);
}

// isoDate: "AAAA-MM-DD".
export function isColombianHoliday(isoDate) {
  const year = Number(String(isoDate).slice(0, 4));
  return getColombianHolidays(year).includes(isoDate);
}
