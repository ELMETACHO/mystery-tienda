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

// Correo del remitente (address_from.email) que se le manda a Skydropx.
// Caso real (septiembre 2026): al cambiar de fabricante, MANUFACTURER_EMAIL
// quedó guardado en Vercel con un salto de línea invisible al final
// ("correo@gmail.com\n", típico al pegar en el panel) — las
// transportadoras (Envía y Servientrega) lo rechazaron con
// SHIPPER_EMAIL_NOT_VALID y NINGUNA guía se pudo generar, aunque el
// correo en sí era perfectamente válido. Por eso acá el valor SIEMPRE se
// limpia (trim) y se valida el formato antes de usarlo; si sigue sin
// ser un correo válido, cae a un respaldo válido en vez de mandar
// basura a la transportadora. RESEND_FROM_EMAIL trae el formato
// "Nombre <correo@dominio>", así que del respaldo se extrae solo el
// correo entre <>.
const BASIC_EMAIL_REGEX = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const FALLBACK_SHIPPER_EMAIL = "contacto@elmetacho.com";

function getShipperEmail() {
  const candidates = [
    process.env.MANUFACTURER_EMAIL,
    (process.env.RESEND_FROM_EMAIL || "").match(/<([^>]+)>/)?.[1] || process.env.RESEND_FROM_EMAIL,
  ];
  for (const candidate of candidates) {
    const cleaned = String(candidate || "").trim();
    if (BASIC_EMAIL_REGEX.test(cleaned)) return cleaned;
  }
  return FALLBACK_SHIPPER_EMAIL;
}

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
// de forma segura (ver createManualShipment más abajo), nunca bloquea el
// pedido.
function buildDestinationAddress(customer) {
  return {
    country_code: "CO",
    postal_code: customer.postalCode || "",
    area_level1: normalizeAreaName(customer.department || ""),
    area_level2: normalizeAreaName(customer.city),
    area_level3: normalizeAreaName(customer.neighborhood),
  };
}

// Tamaños fuera de catálogo (pedidos especiales cotizados a mano por
// Oscar, ej. 100x140 — no aparecen como opción de compra en /crear/
// /checkout, SIZES se queda intacto para no ofrecerlos ahí) pero que sí
// necesitan generar una guía real de Skydropx. Medidas de caja basadas en
// la cotización real hecha para Barranquilla (sept 2026, ver ADS.md/
// conversación) — ajustar aquí si se cotiza un tamaño especial distinto.
const CUSTOM_SIZE_SPECS = {
  "100x140": { packageCm: { length: 145, width: 105, height: 8 }, weightKg: 10 },
};

function getSizeSpec(sizeId) {
  const size = SIZES.find((s) => s.id === sizeId) || CUSTOM_SIZE_SPECS[sizeId];
  if (!size) {
    throw new Error(`Tamaño desconocido para cotizar envío: ${sizeId}`);
  }
  return size;
}

// BUG REAL corregido (sept 2026, ver conversación): para pedidos
// contraentrega, `order.priceCOP` es SIEMPRE el precio TOTAL del cuadro
// (nunca se reduce por el anticipo ya pagado — ver saveManualShipmentRequest
// en manualShipments.js). Hasta este cambio, ese mismo `order.priceCOP`
// total se mandaba tal cual a Skydropx como `declared_value`/
// `declared_amount` — y Skydropx SÍ cobra ese valor exacto contraentrega
// (confirmado contra su propio panel: pedidos reales mostraban el precio
// completo como "Monto" a cobrar, no el saldo). Resultado: todo cliente
// contraentrega pagaba el anticipo de $20.000 (COD_DEPOSIT_COP, ver
// order.js) Y DESPUÉS el precio completo otra vez al recibir — $20.000 de
// más por pedido, silenciosamente, desde que existe esta guía manual.
//
// Ahora, para pedidos con isCod=true, se declara/cobra el SALDO pendiente
// (codAmountCOP, viene de record.saldoPendiente en manualShipments.js) en
// vez del precio total. Para pedidos de pago completo (isCod=false) no
// cambia nada: no hay nada que cobrar contraentrega, así que se sigue
// declarando el precio total como valor asegurado del paquete.
function getCodAmount({ order, isCod, codAmountCOP }) {
  if (!isCod) return order.priceCOP;
  // Respaldo defensivo: si por lo que sea no llega codAmountCOP (ej. una
  // guía vieja generada antes de este cambio, sin saldoPendiente guardado),
  // caer al precio total es el comportamiento previo — no ideal, pero
  // nunca lanza ni bloquea la generación de la guía.
  return typeof codAmountCOP === "number" ? codAmountCOP : order.priceCOP;
}

async function createQuotation({ order, customer, isCod, codAmountCOP }) {
  const { packageCm, weightKg } = getSizeSpec(order.sizeId);

  const res = await skydropxFetch("/api/v1/quotations", {
    method: "POST",
    body: JSON.stringify({
      quotation: {
        address_from: buildOriginAddress(),
        address_to: buildDestinationAddress(customer),
        // cash_on_delivery en la cotización para que las tarifas devueltas
        // ya reflejen transportadoras/costos compatibles con contraentrega
        // cuando aplica. El nombre exacto del campo tampoco está
        // documentado públicamente para este paso — se envía junto al ya
        // usado en createShipment.
        cash_on_delivery: isCod,
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
          declared_amount: getDeclaredValue(getCodAmount({ order, isCod, codAmountCOP })),
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

// Tope DURO de costo por guía (decisión de Oscar, 24 sept 2026): ningún
// envío puede costar más de esto, sin importar la distancia. Caso real que
// lo motivó: guía Coordinadora a Maicao (Arle Medina, contraentrega) por
// $64.913 — el pedido terminó dando pérdida (Servientrega cotizaba
// $24.361 al mismo destino). Si la tarifa más barata supera el tope, NO se
// genera ninguna guía (ver createManualShipment) y se le devuelve el
// dinero al cliente (ver app/lib/noCoverage.js).
export const MAX_SHIPPING_COST_COP = 26000;

function ratePrice(rate) {
  return Number(rate.total || rate.amount || rate.price || Infinity);
}

function cheapestOf(rates) {
  if (rates.length === 0) return null;
  return rates.reduce((cheapest, rate) => (ratePrice(rate) < ratePrice(cheapest) ? rate : cheapest));
}

function rateCarrierName(rate) {
  return String(rate.carrier_name || rate.carrier || rate.provider_name || "").toLowerCase();
}

// Servientrega estuvo "vetada" del 23 al 24 sept 2026 (exigía protección
// adicional, caja y valor declarado, y devolvió pedidos que no cumplían),
// pero evitarla salió MUY caro en destinos lejanos (ver
// MAX_SHIPPING_COST_COP). Volvió a competir en igualdad por precio; cuando
// gana, createManualShipment marca requiresExtraProtection para avisarle
// al fabricante que debe empacar el cuadro en caja y con protección extra.
function isServientrega(rate) {
  return rateCarrierName(rate).includes("servientrega");
}

// Para pedidos SIN contraentrega (pago completo por Wompi) no hay
// restricción de transportadora — cualquiera que haya cotizado sirve.
// Para contraentrega, solo cuentan las que sabemos que soportan recaudo en
// efectivo (COD_CARRIERS). En ambos casos se toma la más barata, Servientrega
// incluida.
function pickRate(rates, { isCod }) {
  const eligible = isCod
    ? rates.filter((rate) => COD_CARRIERS.some((name) => rateCarrierName(rate).includes(name)))
    : rates;

  const rate = cheapestOf(eligible);
  return { rate, requiresExtraProtection: Boolean(rate) && isServientrega(rate) };
}

function formatCOPPlain(value) {
  return `$${Math.round(value).toLocaleString("es-CO")}`;
}

function shippingTooExpensiveError(costCOP, carrierName) {
  const err = new Error(
    `El envío más barato para esta dirección cuesta ${formatCOPPlain(costCOP)}${
      carrierName ? ` (${carrierName})` : ""
    }, más que el tope de ${formatCOPPlain(MAX_SHIPPING_COST_COP)}. No se generó ninguna guía. NO despaches este cuadro: se le devuelve el dinero al cliente.`
  );
  err.shippingTooExpensive = true;
  err.shippingCostCOP = Math.round(costCOP);
  err.carrierName = carrierName || null;
  return err;
}

// La creación de guía en Skydropx es ASÍNCRONA: el POST a /api/v1/shipments
// devuelve 202 casi de inmediato con workflow_status "in_progress" y
// tracking_number/label_url en null — la guía se sigue generando del lado
// de la transportadora. Se descubrió esto DESPUÉS de un caso real (pedido
// con guía Servientrega #2259219169) donde la guía sí se creó exitosamente
// en Skydropx, pero el código leía la respuesta del POST inicial (todavía
// "in_progress") y la trataba como fallo silencioso — el cliente nunca
// recibió el correo de envío y el fabricante vio "SIN GUÍA" con una guía
// real ya cobrada. Por eso se consulta el shipment de nuevo (GET) hasta
// que workflow_status deje de ser "in_progress" o se agoten los intentos.
async function pollShipmentUntilReady(shipmentId, { attempts = 6, delayMs = 2000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const res = await skydropxFetch(`/api/v1/shipments/${shipmentId}`);
    if (!res.ok) {
      // Un fallo puntual al consultar no debe tumbar la creación de guía
      // que ya sabemos que fue aceptada (202) — se reintenta en la
      // siguiente vuelta en vez de lanzar de inmediato.
      if (i === attempts - 1) {
        const text = await res.text().catch(() => "");
        throw new Error(`Skydropx: error consultando la guía (${res.status}): ${text}`);
      }
    } else {
      const body = await res.json();
      const attributes = body.data?.attributes || {};
      const packageResource = (body.included || []).find((r) => r.type === "package");
      const packageAttrs = packageResource?.attributes || {};
      if (attributes.workflow_status !== "in_progress") {
        return { attributes, packageAttrs };
      }
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  // Se agotaron los intentos sin que la guía saliera de "in_progress" —
  // devuelve lo último que se tenga (probablemente sin tracking_number
  // todavía); createManualShipment/generate-shipment lo tratan igual que
  // un fallo (guía sin generar), aunque puede terminar de generarse
  // minutos después del lado de Skydropx.
  return null;
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
async function createShipment({ rate, order, customer, reference, isCod, codAmountCOP }) {
  const declaredValue = getDeclaredValue(getCodAmount({ order, isCod, codAmountCOP }));
  const destinationPhone = normalizePhone(customer.phone);

  const res = await skydropxFetch("/api/v1/shipments", {
    method: "POST",
    body: JSON.stringify({
      shipment: {
        rate_id: rate.id,
        order_number: reference,
        declared_value: declaredValue,
        is_cod: isCod,
        include_shipping_cost: true,
        package_type: "box",
        package_content: "Cuadro decorativo personalizado",
        address_from: {
          name: ORIGIN.name,
          email: getShipperEmail(),
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
          email: String(customer.email || "").trim(),
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
  const shipmentId = body.data?.id;
  let attributes = body.data?.attributes || {};
  let packageResource = (body.included || []).find((r) => r.type === "package");
  let packageAttrs = packageResource?.attributes || {};

  // El 202 inicial casi siempre viene con workflow_status "in_progress" y
  // tracking_number/label_url en null — hay que volver a consultar hasta
  // que la transportadora termine de generar la guía (ver
  // pollShipmentUntilReady más arriba).
  if (attributes.workflow_status === "in_progress" && shipmentId) {
    const polled = await pollShipmentUntilReady(shipmentId);
    if (polled) {
      attributes = polled.attributes;
      packageAttrs = polled.packageAttrs;
    }
  }

  const trackingNumber =
    packageAttrs.tracking_number || attributes.master_tracking_number || null;
  const labelUrl = packageAttrs.label_url || null;

  // Log explícito de éxito justo después de confirmar la creación de la
  // guía, ANTES de cualquier paso posterior (correo al cliente, Redis,
  // etc.) que pueda fallar por su cuenta — así, si algo falla más
  // adelante, los logs ya prueban que la guía sí se creó bien y el
  // problema está en otro lado (caso real: guía Servientrega
  // #2259219169 sí se creó, pero se leyó como fallo porque el código no
  // esperaba a que saliera de "in_progress").
  if (trackingNumber) {
    console.log(`[skydropx] Guía creada: ${trackingNumber} (${attributes.carrier_name || rate.carrier_name || rate.provider_name || "?"})`);
  } else {
    console.warn(
      `[skydropx] La guía se aceptó (shipment ${shipmentId}) pero sigue sin tracking_number tras reintentar — workflow_status: ${attributes.workflow_status}`
    );
  }

  return {
    // Id interno de Skydropx (UUID) del shipment — necesario para poder
    // cancelarlo después (ver cancelShipment más abajo). No es lo mismo
    // que trackingNumber (el número de guía de la transportadora); antes
    // de agregar este campo no se guardaba en ningún lado, así que los
    // pedidos con guía generada ANTES de este cambio no lo tienen — para
    // esos, findShipmentIdByTrackingNumber() es el fallback.
    shipmentId: shipmentId || null,
    trackingNumber,
    carrierName: attributes.carrier_name || rate.carrier_name || rate.provider_name || "",
    labelUrl,
    // Página de rastreo genérica que da la transportadora (ej.
    // "https://envia.co/") — no siempre es un deep-link directo al número
    // de guía, pero es lo único que devuelve la API además del label_url.
    trackingUrl: packageAttrs.tracking_url_provider || null,
    // Costo REAL que cobra Skydropx por esta guía (attributes.total, ej.
    // "9045.0") — confirmado viendo la respuesta real de la API al
    // consultar un shipment. Se guarda junto al pedido (ver
    // recordManufacturerOrder en app/lib/manufacturerFinance.js) para
    // sumarlo como gasto automático en el reporte financiero de
    // /admin/reporte, en vez de tener que anotarlo a mano.
    shippingCostCOP: attributes.total != null ? Math.round(Number(attributes.total)) : null,
  };
}

// Orquesta cotización → elegir la mejor tarifa → crear la guía, para
// AMBOS tipos de pedido: contraentrega (isCod: true, solo transportadoras
// que soportan recaudo — COD_CARRIERS) y pago completo por Wompi (isCod:
// false, cualquier transportadora que cotice, sin monto a recaudar).
//
// Ya NO se llama automáticamente al confirmar el pago (ver diseño en
// CLAUDE.md: "botón generar guía") — el único llamador es
// app/api/generate-shipment/route.js, disparado cuando el fabricante
// confirma desde su correo que el cuadro está listo. Nunca debe tumbar esa
// confirmación: cualquier error se captura en ese endpoint, donde queda
// registrado para reintentar (la solicitud en Redis sigue en status
// "pending" — ver app/lib/manualShipments.js).
export async function createManualShipment({ order, customer, reference, isCod, codAmountCOP }) {
  const quotationId = await createQuotation({ order, customer, isCod, codAmountCOP });
  const rates = await pollQuotationRates(quotationId);

  const { rate: bestRate, requiresExtraProtection } = pickRate(rates, { isCod });
  if (!bestRate) {
    // Se marca con noEligibleCarrier para distinguir "cotizó pero ninguna
    // transportadora disponible" de un error técnico — ver
    // app/api/generate-shipment/route.js.
    const err = new Error(
      isCod
        ? `Skydropx: se cotizó pero ninguna transportadora habilitada para contraentrega (${COD_CARRIERS.join(
            "/"
          )}) está disponible para esta dirección.`
        : "Skydropx: se cotizó pero no se encontró ninguna tarifa disponible para esta dirección."
    );
    err.noEligibleCarrier = true;
    throw err;
  }

  // Tope duro ANTES de crear la guía — así nunca se paga un envío caro.
  if (ratePrice(bestRate) > MAX_SHIPPING_COST_COP) {
    throw shippingTooExpensiveError(ratePrice(bestRate), rateCarrierName(bestRate));
  }

  const shipment = await createShipment({ rate: bestRate, order, customer, reference, isCod, codAmountCOP });

  // Red de seguridad: el costo final de la guía puede diferir un poco de la
  // cotización. Si aun así se pasó del tope, se cancela de inmediato (recién
  // creada, nunca escaneada → Skydropx la reembolsa) y se trata como fallo.
  if (shipment.shippingCostCOP != null && shipment.shippingCostCOP > MAX_SHIPPING_COST_COP) {
    try {
      if (shipment.shipmentId) {
        await cancelShipment(shipment.shipmentId, { reason: "Costo de envío por encima del tope" });
      }
    } catch (cancelErr) {
      console.error(
        `[skydropx] La guía ${shipment.trackingNumber} superó el tope y NO se pudo cancelar sola — cancelarla a mano:`,
        cancelErr
      );
    }
    throw shippingTooExpensiveError(shipment.shippingCostCOP, shipment.carrierName);
  }

  // true cuando la guía salió por Servientrega (ver pickRate) — los
  // llamadores le avisan al fabricante que debe proteger mucho más el
  // cuadro (sendExtraProtectionEmail en app/lib/email.js).
  return { ...shipment, requiresExtraProtection };
}

// Cancela una guía ya generada. Endpoint descubierto probando contra la
// cuenta real de producción (no está en la documentación pública de
// Skydropx que se pudo consultar, que solo describe una API distinta,
// "cancel_label_requests" en api.skydropx.com — esta cuenta usa la API
// PRO en pro.skydropx.com/api-pro.skydropx.com). Devuelve
// {success, status, reason} tal cual lo manda Skydropx; lanza si la
// llamada falla o si success no viene true.
export async function cancelShipment(shipmentId, { reason } = {}) {
  const res = await skydropxFetch(`/api/v1/shipments/${shipmentId}/cancellations`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Skydropx: error cancelando la guía (${res.status}): ${text}`);
  }

  const body = await res.json();
  if (!body.success) {
    throw new Error(`Skydropx: la cancelación no se aprobó (status: ${body.status || "?"}).`);
  }
  return body;
}

// Fallback para guías generadas ANTES de guardar shipmentId (ver
// createShipment): Skydropx no expone un filtro confiable por
// order_number/tracking_number en GET /api/v1/shipments (probado en vivo:
// el parámetro se ignora en vez de filtrar), así que hay que paginar la
// lista completa de shipments de la cuenta hasta encontrar el que
// coincide por master_tracking_number. Con el volumen de esta cuenta esto
// es aceptable (mismo criterio que otros escaneos puntuales del
// proyecto); si algún día crece mucho, lo correcto sería empezar a
// guardar shipmentId en todos lados y borrar este fallback.
export async function findShipmentIdByTrackingNumber(trackingNumber, { maxPages = 20 } = {}) {
  if (!trackingNumber) return null;

  for (let page = 1; page <= maxPages; page++) {
    const res = await skydropxFetch(`/api/v1/shipments?page=${page}&per_page=50`);
    if (!res.ok) return null;

    const body = await res.json();
    const data = body.data || [];
    if (data.length === 0) return null;

    const match = data.find((s) => s.attributes?.master_tracking_number === trackingNumber);
    if (match) return match.id;
  }
  return null;
}
