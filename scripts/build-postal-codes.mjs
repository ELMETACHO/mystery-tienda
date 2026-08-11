// Genera app/lib/postalCodesData.json a partir del catálogo canónico de
// Skydropx (scripts/skydropx-postal-raw.tsv, entregado por soporte —
// ticket #47432505243). Se corre a mano cuando el catálogo cambie:
//   node scripts/build-postal-codes.mjs
import { readFileSync, writeFileSync } from "fs";

function stripAccents(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalize(s) {
  return stripAccents(String(s || ""))
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Normaliza variantes/typos del catálogo crudo a un nombre de departamento
// canónico único (coincide con la lista de departamentos que ya muestra el
// selector de /checkout, sin tildes).
const DEPARTMENT_ALIASES = {
  BOGOTA: "BOGOTA D.C.",
  "BOGOTA D.C.": "BOGOTA D.C.",
  "BOGOTA, D.C.": "BOGOTA D.C.",
  "ARCHIPIELAGO DE SAN ANDRES, PROVIDENCIA Y SANTA CATALINA":
    "SAN ANDRES Y PROVIDENCIA",
  HULA: "HUILA",
  MNARINOETA: "NARINO",
};

function canonicalDept(rawDept) {
  const norm = normalize(rawDept);
  return DEPARTMENT_ALIASES[norm] || norm;
}

const raw = readFileSync(
  new URL("./skydropx-postal-raw.tsv", import.meta.url),
  "utf-8"
);

const map = {};
let count = 0;
for (const line of raw.split("\n")) {
  if (!line.trim()) continue;
  const parts = line.split("\t");
  if (parts.length !== 3) {
    console.warn("Línea con formato inesperado, se ignora:", line);
    continue;
  }
  const [rawDept, rawCity, code] = parts;
  const dept = canonicalDept(rawDept);
  const city = normalize(rawCity);
  if (!map[dept]) map[dept] = {};
  // Si hay colisión (mismo nombre de ciudad repetido para el mismo depto),
  // se mantiene el primero — no debería pasar en el catálogo fuente.
  if (!(city in map[dept])) {
    map[dept][city] = code.trim();
    count++;
  }
}

const outPath = new URL("../app/lib/postalCodesData.json", import.meta.url);
writeFileSync(outPath, JSON.stringify(map, null, 2) + "\n");
console.log(
  `OK: ${count} entradas en ${Object.keys(map).length} departamentos -> ${outPath.pathname}`
);
