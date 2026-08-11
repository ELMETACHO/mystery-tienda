// Prueba de SOLO COTIZACIÓN contra Skydropx (no crea guías) para validar
// que el código postal automático (app/lib/postalCodes.js) resuelve bien
// contra el catálogo real. Uso: node -r dotenv/config scripts/test-quotations.mjs
// (o con next/env cargado — ver comando en la sesión).
import { lookupPostalCode } from "./_test-lookup.mjs";

const SKYDROPX_ENV = process.env.SKYDROPX_ENV === "production" ? "production" : "sandbox";
const SKYDROPX_BASE_URL =
  process.env.SKYDROPX_BASE_URL ||
  (SKYDROPX_ENV === "production"
    ? "https://api-pro.skydropx.com"
    : "https://sb-pro.skydropx.com");

async function getSkydropxAccessToken() {
  const res = await fetch(`${SKYDROPX_BASE_URL}/api/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SKYDROPX_CLIENT_ID,
      client_secret: process.env.SKYDROPX_CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth falló (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

const ORIGIN = {
  country_code: "CO",
  postal_code: "111611",
  area_level1: "BOGOTÁ D.C.",
  area_level2: "BOGOTÁ D.C.",
  street1: "Cra. 8c #167D - 05",
};

const CASES = [
  { department: "Bogotá D.C.", city: "Bogotá" },
  { department: "Valle del Cauca", city: "Cali" },
  { department: "Antioquia", city: "Medellín" },
  { department: "Atlántico", city: "Barranquilla" },
  { department: "Cauca", city: "Popayán" }, // ciudad aleatoria adicional
];

function normalizeAreaName(name) {
  return String(name || "").toUpperCase();
}

async function quote(accessToken, { department, city }) {
  const postalCode = lookupPostalCode(department, city);
  const res = await fetch(`${SKYDROPX_BASE_URL}/api/v1/quotations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      quotation: {
        address_from: ORIGIN,
        address_to: {
          country_code: "CO",
          postal_code: postalCode || "",
          area_level1: normalizeAreaName(department),
          area_level2: normalizeAreaName(city),
        },
        cash_on_delivery: true,
        parcel: {
          weight: 1,
          length: 50,
          width: 40,
          height: 5,
          mass_unit: "kg",
          distance_unit: "cm",
          declared_amount: 89000,
        },
      },
    }),
  });
  const text = await res.text();
  return { department, city, postalCode, status: res.status, body: text };
}

async function pollRates(accessToken, quotationId, attempts = 6, delayMs = 1500) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(`${SKYDROPX_BASE_URL}/api/v1/quotations/${quotationId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    const rates = data.rates || data.data?.rates || [];
    const ready = rates.filter((r) => r.success !== false);
    if (ready.length > 0) return ready;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return [];
}

const accessToken = await getSkydropxAccessToken();
console.log(`Base URL: ${SKYDROPX_BASE_URL}\n`);

for (const testCase of CASES) {
  const result = await quote(accessToken, testCase);
  console.log(
    `\n=== ${result.department} / ${result.city} (CP resuelto: ${result.postalCode}) ===`
  );
  console.log(`Cotización POST -> ${result.status}`);
  if (result.status >= 400) {
    console.log(result.body);
    continue;
  }
  let quotationId;
  try {
    const parsed = JSON.parse(result.body);
    quotationId = parsed.id || parsed.data?.id;
  } catch {
    console.log("No se pudo parsear la respuesta:", result.body);
    continue;
  }
  const rates = await pollRates(accessToken, quotationId);
  if (rates.length === 0) {
    console.log("Sin tarifas listas todavía (o ninguna disponible).");
  } else {
    for (const rate of rates) {
      const carrier = rate.carrier_name || rate.carrier || rate.provider_name || "?";
      const total = rate.total || rate.amount || rate.price || "?";
      console.log(`  - ${carrier}: $${total}`);
    }
  }
}
