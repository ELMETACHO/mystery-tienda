import postalCodesData from "./postalCodesData.json";

// Catálogo canónico de códigos postales de Skydropx (departamento + ciudad
// -> código postal interno de Skydropx), generado con
// scripts/build-postal-codes.mjs a partir del Excel que entregó soporte
// (ticket #47432505243). Reemplaza los códigos hardcodeados sueltos que se
// probaban antes por ciudad — ver CLAUDE.md, sección Skydropx.

function stripAccents(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalize(s) {
  return stripAccents(String(s || ""))
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Para comparar sin importar puntuación ni espacios: "Bogotá, D. C.",
// "Bogota DC" y "BOGOTÁ D.C." quedan todos como "BOGOTADC". Caso real (oct
// 2026, pedido de Felipe Estupiñan): la ciudad llegó como "Bogotá, D. C.",
// no coincidió con ninguna llave, el pedido quedó sin código postal y
// Skydropx rechazó la cotización ("Ciudad o departamento inválido") cada
// vez que Cris tocó "generar guía".
function compact(s) {
  return normalize(s).replace(/[^A-Z0-9]/g, "");
}

const DEPARTMENT_ALIASES = {
  BOGOTA: "BOGOTA D.C.",
  "BOGOTA D.C.": "BOGOTA D.C.",
  "BOGOTA, D.C.": "BOGOTA D.C.",
};

function canonicalDept(rawDept) {
  const norm = normalize(rawDept);
  if (DEPARTMENT_ALIASES[norm]) return DEPARTMENT_ALIASES[norm];
  const key = compact(rawDept);
  if (key === "BOGOTA" || key === "BOGOTADC" || key === "BOGOTADISTRITOCAPITAL") return "BOGOTA D.C.";
  return Object.keys(postalCodesData).find((d) => compact(d) === key) || norm;
}

// Busca el código postal para un departamento + ciudad escritos por el
// cliente. Intenta, en orden: coincidencia exacta, coincidencia por
// "empieza con" en cualquier dirección (para tolerar que el cliente escriba
// solo "Medellín" cuando el catálogo tiene variantes como
// "MEDELLIN - PALMITAS"), y por último devuelve null si no hay match — el
// checkout nunca debe bloquear el pedido por esto, solo deja de
// autocompletar el campo.
export function lookupPostalCode(department, city) {
  const dept = canonicalDept(department);
  const cityTable = postalCodesData[dept];
  if (!cityTable) return null;

  const normCity = normalize(city);
  if (!normCity) return null;

  if (normCity in cityTable) return cityTable[normCity];

  let bestMatch = null;
  for (const [candidate, code] of Object.entries(cityTable)) {
    const base = candidate.split(" - ")[0];
    if (base === normCity || candidate.startsWith(normCity + " ")) {
      // Preferimos la entrada "principal" (sin corregimiento) cuando exista.
      if (base === normCity) return code;
      if (!bestMatch) bestMatch = code;
    }
  }
  if (bestMatch) return bestMatch;

  // Último intento ignorando puntuación y espacios (ver compact()).
  const compactCity = compact(city);
  for (const [candidate, code] of Object.entries(cityTable)) {
    const base = candidate.split(" - ")[0];
    if (compact(base) === compactCity || compact(candidate) === compactCity) return code;
  }
  for (const [candidate, code] of Object.entries(cityTable)) {
    if (compact(candidate).startsWith(compactCity)) return code;
  }
  // Bogotá D.C. tiene un único código canónico en Skydropx (111611): si el
  // departamento es Bogotá, cualquier forma de escribir la ciudad sirve.
  if (dept === "BOGOTA D.C." && compactCity.startsWith("BOGOTA")) return cityTable["BOGOTA D.C."];
  return null;
}
