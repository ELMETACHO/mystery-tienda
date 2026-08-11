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
//
// Se amplió de solo Servientrega/Interrapidísimo a incluir también
// Coordinadora y Envía: al probar cotizaciones reales confirmamos que en
// Medellín y Barranquilla esas dos transportadoras eran las ÚNICAS
// disponibles con contraentrega — con la lista original, todo pedido COD a
// esas ciudades se quedaba sin guía automática aunque sí había una opción
// viable cotizada.
const COD_CARRIERS = [
  "servientrega",
  "interrapidisimo",
  "interrapidísimo",
  "coordinadora",
  "envia",
  "envía",
];

// Causa raíz confirmada DIRECTAMENTE por soporte de Skydropx: ni el
// 110221 (su propio ejemplo genérico) ni el 110131 (código DANE oficial
// del visor gubernamental) coinciden con el catálogo INTERNO que
// Skydropx usa para Bogotá — no era un problema de formato en general,
// sino específicamente ese código postal. El código correcto para
// Bogotá D.C. en su sistema es 111611. Soporte también confirmó un
// payload de ejemplo que SÍ funciona en producción: area_level1/2 van en
// MAYÚSCULAS y CON tilde ("BOGOTÁ D.C."), al revés de lo que se había
// asumido antes (se probó quitar tildes, que no era la causa real del
// error).
const ORIGIN = {
  name: "CUADROS MYSTERY",
  phone: "3202646716",
  street1: "Cra. 8c #167D - 05",
  areaLevel1: "BOGOTÁ D.C.",
  areaLevel2: "BOGOTÁ D.C.",
  postalCode: "111611",
  country: "CO",
};

// Confirmado por soporte junto con el payload de ejemplo: area_level1/2
// van en mayúsculas (con tilde, no sin ella). Se aplica a los nombres de
// departamento/ciudad/barrio que vienen del formulario de checkout.
function normalizeAreaName(name) {
  return String(name || "").toUpperCase();
}

// Confirmado por soporte: el teléfono debe ser EXACTAMENTE 10 dígitos,
// sin +57 ni espacios/guiones. El campo de celular del checkout no debería
// traer el prefijo (va aparte en phonePrefix), pero por si el cliente lo
// escribe igual dentro del campo, se limpia todo lo que no sea dígito y se
// quita un +57/57 inicial si quedó de 12 dígitos.
function normalizePhone(rawPhone) {
  let digits = String(rawPhone || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) {
    digits = digits.slice(2);
  }
  if (digits.length !== 10) {
    throw new Error(
      `Teléfono de destino inválido para Skydropx (se esperan 10 dígitos): "${rawPhone}"`
    );
  }
  return digits;
}

// Confirmado por soporte: declared_value debe estar entre $10.000 y
// $5.000.000 COP. Nuestros precios (SIZES en app/lib/order.js) ya
// califican siempre, pero se deja el límite explícito como salvaguarda
// por si algún día cambian los precios fuera de ese rango.
const MIN_DECLARED_VALUE_COP = 10000;
const MAX_DECLARED_VALUE_COP = 5000000;
function getDeclaredValue(priceCOP) {
  const clamped = Math.min(
    Math.max(priceCOP, MIN_DECLARED_VALUE_COP),
    MAX_DECLARED_VALUE_COP
  );
  if (clamped !== priceCOP) {
    console.warn(
      `[skydropx] declared_value fuera de rango permitido ($10.000-$5.000.000), se ajustó de ${priceCOP} a ${clamped}.`
    );
  }
  return clamped;
}

// Dirección de origen para la COTIZACIÓN (usa country_code, distinto del
// nombre "country" que espera el endpoint de creación de guía — ver
// createShipment más abajo). Si en algún momento la API pide un id de
// dirección explícito en vez de estos campos, definí
// SKYDROPX_ORIGIN_ADDRESS_ID en .env.local — ese id tiene prioridad.
function buildOriginAddress() {
  const id = process.env.SKYDROPX_ORIGIN_ADDRESS_ID;
  if (id) return { id };

  return {
    country_code: ORIGIN.country,
    postal_code: ORIGIN.postalCode,
    area_level1: ORIGIN.areaLevel1,
    area_level2: ORIGIN.areaLevel2,
    street1: ORIGIN.street1,
  };
}

// El checkout ya captura departamento (selector con los 32 departamentos
// de Colombia + Bogotá D.C., requerido) y código postal (texto libre,
// opcional). Si el cliente deja el código postal vacío, la cotización
// puede fallar igual que fallaba con address_from vacío — eso se degrada
// de forma segura a "sin guía automática" (ver createCodShipment más
// abajo), nunca bloquea el pedido.
function buildDestinationAddress(customer) {
  return {
    country_code: "CO",
    postal_code: customer.postalCode || "",
    area_level1: normalizeAreaName(customer.department || ""),
    area_level2: normalizeAreaName(customer.city),
    area_level3: normalizeAreaName(customer.neighborhood),
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
          // mass_unit/distance_unit: confirmados por soporte en el payload
          // de ejemplo que funciona en producción.
          mass_unit: "kg",
          distance_unit: "cm",
          // Requerido por la API ("declared_amount es obligatorio") — valor
          // asegurado del paquete, usamos el precio de venta del cuadro.
          // (No aparece en el ejemplo de soporte, pero SÍ lo confirmamos
          // nosotros mismos en vivo como campo obligatorio — se mantiene.)
          declared_amount: getDeclaredValue(order.priceCOP),
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

// CORREGIDO tras crear una guía real de prueba (pedido de Alvaro Ríos
// Piña, agosto 2026): la suposición anterior de que el payload iba PLANO
// (sin envolver) era incorrecta — sin el wrapper {shipment: {...}} la API
// devuelve 400 genérico ("parámetros inválidos") sin detalle útil; envuelto
// en "shipment", el mismo request devuelve 422 con el detalle exacto de lo
// que falta. Confirmado con datos reales que el payload correcto necesita:
//   - Wrapper {shipment: {...}}.
//   - email + reference (string libre, ej. el barrio) en CADA address.
//   - package_type ("box") y package_content (string libre) a nivel raíz,
//     además de is_cod/include_shipping_cost que sí seguían siendo correctos.
// La respuesta también es formato JSON:API: el tracking_number, label_url y
// carrier real NO están en data.attributes sino en included[] (el recurso
// "package") — data.attributes solo tiene master_tracking_number.
async function createShipment({ rate, order, customer, reference }) {
  const declaredValue = getDeclaredValue(order.priceCOP);
  const destinationPhone = normalizePhone(customer.phone);
  const { packageCm, weightKg } = getSizeSpec(order.sizeId);

  const res = await skydropxFetch("/api/v1/shipments", {
    method: "POST",
    body: JSON.stringify({
      shipment: {
        rate_id: rate.id,
        order_number: reference,
        declared_value: declaredValue,
        is_cod: true,
        include_shipping_cost: true,
        package_type: "box",
        package_content: "Cuadro decorativo personalizado",
        address_from: {
          name: ORIGIN.name,
          email: process.env.MANUFACTURER_EMAIL || process.env.RESEND_FROM_EMAIL,
          reference: "Origen Mystery",
          phone: ORIGIN.phone,
          street1: ORIGIN.street1,
          area_level1: ORIGIN.areaLevel1,
          area_level2: ORIGIN.areaLevel2,
          postal_code: ORIGIN.postalCode,
          country: ORIGIN.country,
        },
        address_to: {
          name: customer.fullName,
          email: customer.email,
          reference: customer.neighborhood || customer.city,
          phone: destinationPhone,
          street1: customer.street,
          area_level1: normalizeAreaName(customer.department),
          area_level2: normalizeAreaName(customer.city),
          postal_code: customer.postalCode || "",
          country: "CO",
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Skydropx: error creando la guía (${res.status}): ${text}`);
  }

  const body = await res.json();
  const attributes = body.data?.attributes || {};
  const packageResource = (body.included || []).find((r) => r.type === "package");
  const packageAttrs = packageResource?.attributes || {};

  return {
    trackingNumber:
      packageAttrs.tracking_number || attributes.master_tracking_number || null,
    carrierName: attributes.carrier_name || rate.carrier_name || rate.provider_name || "",
    labelUrl: packageAttrs.label_url || null,
    // Página de rastreo genérica que da la transportadora (ej.
    // "https://envia.co/") — no siempre es un deep-link directo al número
    // de guía, pero es lo único que devuelve la API además del label_url.
    trackingUrl: packageAttrs.tracking_url_provider || null,
  };
}

// Orquesta cotización → elegir la tarifa contraentrega más barata (entre
// Servientrega/Interrapidísimo, lo que esté disponible) → crear la guía.
// Nunca debe tumbar el flujo de confirmación del pedido: cualquier error
// se captura afuera, en el endpoint que llama a esta función (ver
// app/api/confirm-cod-order/route.js), donde el pedido sigue su curso sin
// número de guía automático si esto falla.
export async function createCodShipment({ order, customer, reference }) {
  const quotationId = await createQuotation({ order, customer });
  const rates = await pollQuotationRates(quotationId);

  const bestRate = pickCheapestCodRate(rates);
  if (!bestRate) {
    // Se marca con noEligibleCarrier para que el llamador (ver
    // app/api/confirm-cod-order/route.js) pueda distinguir "cotizó pero
    // ninguna transportadora habilitada para COD" de un error técnico, y
    // reflejarlo de forma explícita en el correo al fabricante en vez de
    // dejarlo como un simple log silencioso.
    const err = new Error(
      `Skydropx: se cotizó pero ninguna transportadora habilitada para contraentrega (${COD_CARRIERS.join(
        "/"
      )}) está disponible para esta dirección.`
    );
    err.noEligibleCarrier = true;
    throw err;
  }

  return createShipment({ rate: bestRate, order, customer, reference });
}
