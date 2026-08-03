import { SIZES } from "./order";

// Autenticación OAuth de Skydropx PRO (client_credentials).
// Docs: POST {base}/api/v1/oauth/token, body x-www-form-urlencoded con
// grant_type=client_credentials + client_id + client_secret. El token dura
// ~2 horas (`expires_in`, segundos) — se cachea en memoria del proceso y
// se renueva solo cuando está por vencer, en vez de pedir uno nuevo en
// cada llamada.
//
// El "invalid_client" que se veía antes era un desajuste de ambiente:
// las credenciales de esa vez eran de producción, pero se probaron contra
// hosts de sandbox. Con credenciales nuevas generadas explícitamente en
// modo Producción, la autenticación fue verificada en vivo y funciona
// tanto en https://pro.skydropx.com como en https://api-pro.skydropx.com
// (los dos devuelven access_token 200 OK). SKYDROPX_BASE_URL queda fijo
// en pro.skydropx.com (.env.local) por ser el host que usan de forma
// consistente los ejemplos de la documentación oficial.
const SKYDROPX_ENV = process.env.SKYDROPX_ENV === "production" ? "production" : "sandbox";

export const SKYDROPX_BASE_URL =
  process.env.SKYDROPX_BASE_URL ||
  (SKYDROPX_ENV === "production"
    ? "https://api-pro.skydropx.com"
    : "https://sb-pro.skydropx.com");

// Cache en memoria del proceso (persiste entre invocaciones "calientes" de
// la misma instancia serverless). No hay problema en compartirlo entre
// requests: es un token de la app, no de un usuario particular.
let cachedToken = null; // { accessToken, expiresAt }

// Margen de seguridad antes del vencimiento real, para no arriesgarnos a
// usar un token que expire a mitad de una request.
const EXPIRY_SAFETY_MARGIN_MS = 30_000;

export async function getSkydropxAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + EXPIRY_SAFETY_MARGIN_MS) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.SKYDROPX_CLIENT_ID;
  const clientSecret = process.env.SKYDROPX_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Faltan SKYDROPX_CLIENT_ID / SKYDROPX_CLIENT_SECRET en las variables de entorno."
    );
  }

  const res = await fetch(`${SKYDROPX_BASE_URL}/api/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Skydropx OAuth falló (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Respuesta de Skydropx OAuth sin access_token.");
  }

  cachedToken = {
    accessToken: data.access_token,
    // expires_in viene en segundos (típicamente 7200 = 2 horas).
    expiresAt: now + data.expires_in * 1000,
  };

  return cachedToken.accessToken;
}

async function skydropxFetch(path, options = {}) {
  const accessToken = await getSkydropxAccessToken();
  const res = await fetch(`${SKYDROPX_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  return res;
}

// Transportadoras habilitadas para contraentrega — coincide por substring
// (case-insensitive) contra el nombre de cada tarifa devuelta por la
// cotización, ya que el campo exacto puede venir como carrier/carrier_name/
// provider_name según el endpoint.
const COD_CARRIERS = ["servientrega", "interrapidisimo", "interrapidísimo"];

// Dirección de origen: comprobado en vivo que la API de cotizaciones NO
// usa la dirección default de la cuenta ("CUADROS MYSTERY") aunque esté
// marcada como predeterminada en el dashboard — exige address_from
// completo en cada request (country_code/postal_code/area_level1/
// area_level2 en blanco produce 422). Origen real confirmado: Bogotá,
// código postal 110141. Bogotá no es un departamento como tal, así que se
// usa "Bogotá D.C." como area_level1 (mismo valor que ofrece el selector
// de departamento en el checkout) y "Bogotá" como area_level2 (ciudad).
// Si más adelante la API pide un id de dirección explícito en vez de
// estos campos, definí SKYDROPX_ORIGIN_ADDRESS_ID en .env.local — ese id
// tiene prioridad sobre los campos fijos de abajo.
function buildOriginAddress() {
  const id = process.env.SKYDROPX_ORIGIN_ADDRESS_ID;
  if (id) return { id };

  return {
    country_code: "CO",
    postal_code: "110141",
    area_level1: "Bogotá D.C.",
    area_level2: "Bogotá",
  };
}

// El checkout ya captura departamento (selector con los 32 departamentos
// de Colombia + Bogotá D.C., requerido) y código postal (texto libre,
// opcional — Skydropx puede cotizar con area_level1/area_level2 aunque
// postal_code venga vacío). Si de todos modos alguna dirección no cotiza
// bien, esto se sigue degradando de forma segura a "sin guía automática"
// (ver createCodShipment más abajo), nunca bloquea el pedido.
function buildDestinationAddress(customer) {
  return {
    country_code: "CO",
    postal_code: customer.postalCode || "",
    area_level1: customer.department || "",
    area_level2: customer.city,
    area_level3: customer.neighborhood,
  };
}

function getSizeSpec(sizeId) {
  const size = SIZES.find((s) => s.id === sizeId);
  if (!size) {
    throw new Error(`Tamaño desconocido para cotizar envío: ${sizeId}`);
  }
  return size;
}

async function createQuotation({ order, customer }) {
  const { packageCm, weightKg } = getSizeSpec(order.sizeId);

  const res = await skydropxFetch("/api/v1/quotations", {
    method: "POST",
    body: JSON.stringify({
      quotation: {
        address_from: buildOriginAddress(),
        address_to: buildDestinationAddress(customer),
        // cash_on_delivery en la cotización para que las tarifas devueltas
        // ya reflejen transportadoras/costos compatibles con contraentrega.
        // El nombre exacto del campo tampoco está documentado públicamente
        // para este paso — se envía junto al ya usado en createShipment.
        cash_on_delivery: true,
        parcel: {
          weight: weightKg,
          length: packageCm.length,
          width: packageCm.width,
          height: packageCm.height,
          // Requerido por la API ("declared_amount es obligatorio") — valor
          // asegurado del paquete, usamos el precio de venta del cuadro.
          declared_amount: order.priceCOP,
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Skydropx: error creando cotización (${res.status}): ${text}`);
  }

  const data = await res.json();
  const quotationId = data.id || data.data?.id;
  if (!quotationId) {
    throw new Error("Skydropx: la cotización no devolvió un id.");
  }
  return quotationId;
}

// Las cotizaciones de Skydropx se procesan de forma asíncrona (arrancan en
// estado "pending" y las tarifas van llegando) — se consulta un par de
// veces con una pequeña espera entre intentos, en vez de asumir que están
// listas de inmediato.
async function pollQuotationRates(quotationId, { attempts = 5, delayMs = 1500 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const res = await skydropxFetch(`/api/v1/quotations/${quotationId}`);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Skydropx: error consultando cotización (${res.status}): ${text}`);
    }
    const data = await res.json();
    const rates = data.rates || data.data?.rates || [];
    const readyRates = rates.filter((r) => r.success !== false);
    if (readyRates.length > 0) return readyRates;

    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return [];
}

function pickCheapestCodRate(rates) {
  const eligible = rates.filter((rate) => {
    const carrierName = String(
      rate.carrier_name || rate.carrier || rate.provider_name || ""
    ).toLowerCase();
    return COD_CARRIERS.some((name) => carrierName.includes(name));
  });

  if (eligible.length === 0) return null;

  return eligible.reduce((cheapest, rate) => {
    const price = Number(rate.total || rate.amount || rate.price || Infinity);
    const cheapestPrice = Number(
      cheapest.total || cheapest.amount || cheapest.price || Infinity
    );
    return price < cheapestPrice ? rate : cheapest;
  });
}

async function createShipment({ rate, order, customer }) {
  // Campos de contraentrega: el nombre exacto de este campo NO está
  // confirmado (no hay documentación pública accesible que lo detalle) —
  // se envían varias variantes comunes a la vez (inofensivo: una API REST
  // normalmente ignora claves que no reconoce) como mejor esfuerzo.
  // IMPORTANTE: verificar manualmente en el dashboard de Skydropx que la
  // primera guía de prueba realmente quedó marcada como contraentrega por
  // el monto correcto antes de confiar en esto para pedidos reales.
  const codAmount = order.priceCOP;

  const res = await skydropxFetch("/api/v1/shipments", {
    method: "POST",
    body: JSON.stringify({
      shipment: {
        rate_id: rate.id,
        cod: true,
        cod_amount: codAmount,
        cash_on_delivery: { amount: codAmount, currency: "COP" },
        address_from: {
          ...buildOriginAddress(),
          name: "CUADROS MYSTERY",
        },
        address_to: {
          ...buildDestinationAddress(customer),
          name: customer.fullName,
          phone: `${customer.phonePrefix}${customer.phone}`,
          email: customer.email,
          street1: customer.street,
          reference:
            customer.housingType === "apartamento"
              ? [customer.buildingName, customer.tower, customer.apartmentNumber]
                  .filter(Boolean)
                  .join(" ")
              : customer.additionalInstructions || "",
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Skydropx: error creando la guía (${res.status}): ${text}`);
  }

  const data = await res.json();
  const shipment = data.data || data;
  return {
    trackingNumber: shipment.tracking_number || shipment.tracking || shipment.id,
    carrierName: rate.carrier_name || rate.carrier || rate.provider_name || "",
    labelUrl: shipment.label_url || shipment.label || null,
  };
}

// Orquesta cotización → elegir la tarifa contraentrega más barata (entre
// Servientrega/Interrapidísimo, lo que esté disponible) → crear la guía.
// Nunca debe tumbar el flujo de confirmación del pedido: cualquier error
// se captura afuera, en el endpoint que llama a esta función (ver
// app/api/confirm-cod-order/route.js), donde el pedido sigue su curso sin
// número de guía automático si esto falla.
export async function createCodShipment({ order, customer }) {
  const quotationId = await createQuotation({ order, customer });
  const rates = await pollQuotationRates(quotationId);

  const bestRate = pickCheapestCodRate(rates);
  if (!bestRate) {
    throw new Error(
      "Skydropx: no se encontró ninguna tarifa de Servientrega/Interrapidísimo disponible para esta dirección."
    );
  }

  return createShipment({ rate: bestRate, order, customer });
}
