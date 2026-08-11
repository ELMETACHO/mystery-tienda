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

const DEPARTMENT_ALIASES = {
  BOGOTA: "BOGOTA D.C.",
  "BOGOTA D.C.": "BOGOTA D.C.",
  "BOGOTA, D.C.": "BOGOTA D.C.",
};

function canonicalDept(rawDept) {
  const norm = normalize(rawDept);
  return DEPARTMENT_ALIASES[norm] || norm;
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
  return bestMatch;
}
