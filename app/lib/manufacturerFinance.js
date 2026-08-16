import Redis from "ioredis";
import { SIZES } from "./order";
import { getOrderCount } from "./loyalty";

// Fuente de verdad única del saldo pendiente al fabricante y del CRM:
// Redis (ya no se espeja nada en Google Sheets).
//
// fabricante:balance -> string numérico, saldo total pendiente en COP.
// fabricante:orders  -> hash, field=reference, value=JSON del pedido
// (cliente, ciudad, tamaño, monto, fecha, guideUrl, paid).
// crm:entries -> lista, cada elemento es el JSON de una entrada CRM
// (nombre, teléfono, dirección, correo, tamaño, método de pago,
// cupón/referido, fecha, total histórico de compras), más reciente al
// final (se lee con lrange + reverse).

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.on("error", (err) => {
      console.error("[manufacturerFinance] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

const BALANCE_KEY = "fabricante:balance";
const ORDERS_KEY = "fabricante:orders";
const LAST_PAYMENT_KEY = "fabricante:last-payment";
const CRM_KEY = "crm:entries";

function sizeLabel(sizeId) {
  return SIZES.find((s) => s.id === sizeId)?.label || sizeId;
}

function fabricanteCost(sizeId) {
  return SIZES.find((s) => s.id === sizeId)?.fabricanteCostCOP || 0;
}

// Registra el pedido en fabricante:orders + suma el costo al balance.
//
// Se llama SOLO desde app/api/generate-shipment/route.js, DESPUÉS de
// que Skydropx confirmó un trackingNumber real — nunca desde la
// confirmación del pago. Así, la única evidencia que genera una deuda
// real es una guía de transporte efectivamente creada (el cuadro ya se
// fabricó y se entregó a la transportadora); pedidos de prueba,
// cancelados, o que nunca llegan a fabricarse no generan deuda.
// Nunca lanza — un fallo acá no debe tumbar la respuesta de éxito de la
// guía ya generada en Skydropx.
export async function recordManufacturerOrder({
  reference,
  order,
  customer,
  guideUrl,
  shipmentId,
  trackingNumber,
  carrierName,
}) {
  const client = getRedisClient();
  if (!client) {
    console.error(
      "[manufacturerFinance] REDIS_URL no está configurado; no se registró el pedido del fabricante."
    );
    return;
  }

  const monto = fabricanteCost(order.sizeId);
  const fecha = new Date().toISOString();

  const record = {
    reference,
    cliente: customer.fullName,
    ciudad: customer.city,
    sizeId: order.sizeId,
    monto,
    fecha,
    guideUrl: guideUrl || null,
    // Solo para pedidos de catálogo (ver app/lib/manualShipments.js) —
    // null para pedidos personalizados de /crear, que nunca guardan la
    // foto completa. app/fabricante/page.js muestra un ícono genérico
    // cuando viene en null.
    thumbnailUrl: order.thumbnailUrl || null,
    // shipmentId/trackingNumber/carrierName: necesarios para poder
    // cancelar la guía después (ver markManufacturerOrderCancelled) sin
    // tener que volver a buscarla en Skydropx.
    shipmentId: shipmentId || null,
    trackingNumber: trackingNumber || null,
    carrierName: carrierName || null,
    // "activo" | "cancelado" — ver markManufacturerOrderCancelled y
    // markManufacturerOrderRegenerated. Los registros creados antes de
    // este campo no lo tienen; se tratan como "activo" por defecto (ver
    // app/fabricante/page.js: `o.status || "activo"`).
    status: "activo",
    cancelReason: null,
    cancelledAt: null,
    paid: false,
  };

  try {
    await client.incrby(BALANCE_KEY, monto);
    await client.hset(ORDERS_KEY, reference, JSON.stringify(record));
  } catch (err) {
    console.error(
      "[manufacturerFinance] No se pudo registrar el pedido del fabricante en Redis:",
      err
    );
  }
}

// Lee un solo pedido de fabricante:orders por reference — usado por los
// botones "Cancelar guía"/"Generar guía nueva" del panel del fabricante
// (ver app/api/fabricante-cancel-shipment y
// app/api/fabricante-generate-shipment) para validar el estado actual
// antes de actuar.
export async function getManufacturerOrder(reference) {
  const client = getRedisClient();
  if (!client || !reference) return null;

  try {
    const raw = await client.hget(ORDERS_KEY, reference);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("[manufacturerFinance] No se pudo leer el pedido del fabricante:", err);
    return null;
  }
}

// Botón "Cancelar guía" del panel del fabricante: marca el pedido como
// "cancelado" (NUNCA lo borra — se conserva el historial completo, motivo
// incluido) y resta su monto de fabricante:balance, ya que sin guía real
// no hay evidencia de que el cuadro se vaya a entregar. Solo resta si el
// pedido seguía sin pagar (si el admin ya lo había marcado paid, ya salió
// del balance pendiente antes, y no hay que tocarlo de nuevo). Devuelve
// el registro actualizado, o null si no existía o Redis falla.
export async function markManufacturerOrderCancelled({ reference, reason }) {
  const client = getRedisClient();
  if (!client || !reference) return null;

  try {
    const raw = await client.hget(ORDERS_KEY, reference);
    if (!raw) return null;

    const record = JSON.parse(raw);
    const updated = {
      ...record,
      status: "cancelado",
      cancelReason: reason,
      cancelledAt: new Date().toISOString(),
    };
    await client.hset(ORDERS_KEY, reference, JSON.stringify(updated));
    if (!record.paid) {
      await client.decrby(BALANCE_KEY, record.monto);
    }
    return updated;
  } catch (err) {
    console.error("[manufacturerFinance] No se pudo cancelar el pedido del fabricante:", err);
    return null;
  }
}

// Botón "Generar guía nueva" (solo visible para pedidos "cancelado"):
// actualiza el registro con los datos de la guía REAL nueva y vuelve a
// sumar el monto a fabricante:balance — ahora sí hay una guía real de
// nuevo, así que vuelve a ser una deuda real (mismo criterio que
// recordManufacturerOrder). Solo suma si el pedido sigue sin pagar (ver
// markManufacturerOrderCancelled).
export async function markManufacturerOrderRegenerated({
  reference,
  guideUrl,
  shipmentId,
  trackingNumber,
  carrierName,
}) {
  const client = getRedisClient();
  if (!client || !reference) return null;

  try {
    const raw = await client.hget(ORDERS_KEY, reference);
    if (!raw) return null;

    const record = JSON.parse(raw);
    const updated = {
      ...record,
      status: "activo",
      guideUrl: guideUrl || null,
      shipmentId: shipmentId || null,
      trackingNumber: trackingNumber || null,
      carrierName: carrierName || null,
      cancelReason: null,
      cancelledAt: null,
    };
    await client.hset(ORDERS_KEY, reference, JSON.stringify(updated));
    if (!record.paid) {
      await client.incrby(BALANCE_KEY, record.monto);
    }
    return updated;
  } catch (err) {
    console.error("[manufacturerFinance] No se pudo regenerar el pedido del fabricante:", err);
    return null;
  }
}

// Comparación tolerante a formato: "+57 320 264 6716" y "3202646716"
// deben contar como el mismo teléfono, "Nombre@Correo.com " y
// "nombre@correo.com" como el mismo correo — sin esto, entradas del
// mismo cliente con formato ligeramente distinto no se detectarían como
// duplicadas.
function normalizePhoneForMatch(value) {
  return String(value || "").replace(/\D/g, "");
}
function normalizeEmailForMatch(value) {
  return String(value || "").trim().toLowerCase();
}

// Agrega o actualiza una entrada del CRM (crm:entries) — datos de
// contacto/compra del cliente, independientes del saldo del fabricante
// (no toca fabricante:balance/fabricante:orders). Nunca lanza.
//
// UNA fila por cliente, no una por pedido: antes de insertar se busca si
// ya existe una entrada con el MISMO teléfono O el MISMO correo (ver
// normalizePhoneForMatch/normalizeEmailForMatch) — si existe, se
// SOBRESCRIBE con los datos de esta compra (fecha más reciente, tamaño
// comprado, método de pago, cupón/referido y totalHistorico actualizados)
// en vez de agregar una fila nueva. totalHistorico ya viene correcto de
// getOrderCount (contador real en loyalty.js, no una suma manual), así
// que sobrescribir es seguro incluso si se pierde alguna fila vieja.
export async function recordCrmEntry({ order, customer, paymentMethod }) {
  const client = getRedisClient();
  if (!client) {
    console.error(
      "[manufacturerFinance] REDIS_URL no está configurado; no se registró la entrada CRM."
    );
    return;
  }

  const totalHistorico = await getOrderCount(customer.email);
  const direccion = [customer.street, customer.neighborhood, customer.city, customer.department]
    .filter(Boolean)
    .join(", ");
  const metodoPago = paymentMethod === "cod" ? "Contraentrega" : "Pago completo";
  const cuponOReferido = order.discountCode || order.referralCode || "";
  const fecha = new Date().toISOString();
  const telefono = `${customer.phonePrefix || ""}${customer.phone || ""}`;
  const correo = customer.email;

  const entry = {
    nombre: customer.fullName,
    telefono,
    direccion,
    correo,
    sizeId: order.sizeId,
    metodoPago,
    cuponOReferido,
    fecha,
    totalHistorico,
  };

  try {
    const raw = await client.lrange(CRM_KEY, 0, -1);
    const normalizedPhone = normalizePhoneForMatch(telefono);
    const normalizedEmail = normalizeEmailForMatch(correo);

    const matchIndex = raw.findIndex((r) => {
      const existing = JSON.parse(r);
      return (
        (normalizedPhone && normalizedPhone === normalizePhoneForMatch(existing.telefono)) ||
        (normalizedEmail && normalizedEmail === normalizeEmailForMatch(existing.correo))
      );
    });

    if (matchIndex === -1) {
      await client.rpush(CRM_KEY, JSON.stringify(entry));
    } else {
      await client.lset(CRM_KEY, matchIndex, JSON.stringify(entry));
    }
  } catch (err) {
    console.error("[manufacturerFinance] No se pudo registrar la entrada CRM en Redis:", err);
  }
}

// Para /admin/finanzas y /fabricante: saldo total + pedidos
// pendientes de pago (más recientes primero) + el último pago registrado
// (ver markManufacturerBalancePaid) — así la vista de solo lectura del
// fabricante puede mostrar "recibiste tu último pago" cuando el saldo
// está en $0, en vez de un silencio sin explicación.
export async function getManufacturerPendingOrders() {
  const client = getRedisClient();
  if (!client) return { balance: 0, orders: [], lastPayment: null };

  try {
    const [balanceRaw, ordersRaw, lastPaymentRaw] = await Promise.all([
      client.get(BALANCE_KEY),
      client.hgetall(ORDERS_KEY),
      client.get(LAST_PAYMENT_KEY),
    ]);

    const orders = Object.values(ordersRaw || {})
      .map((raw) => JSON.parse(raw))
      .filter((o) => !o.paid)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    return {
      balance: Number(balanceRaw) || 0,
      orders,
      lastPayment: lastPaymentRaw ? JSON.parse(lastPaymentRaw) : null,
    };
  } catch (err) {
    console.error("[manufacturerFinance] No se pudo leer el saldo del fabricante:", err);
    return { balance: 0, orders: [], lastPayment: null };
  }
}

// Para /crm: todas las entradas registradas, más recientes primero.
export async function getCrmEntries() {
  const client = getRedisClient();
  if (!client) return [];

  try {
    const raw = await client.lrange(CRM_KEY, 0, -1);
    return raw
      .map((r) => JSON.parse(r))
      .reverse()
      .map((e) => ({ ...e, sizeLabel: sizeLabel(e.sizeId) }));
  } catch (err) {
    console.error("[manufacturerFinance] No se pudieron leer las entradas del CRM:", err);
    return [];
  }
}

// Botón "✅ Ya pagué todo": resetea el balance a 0, marca todos los
// pedidos pendientes como paid:true en Redis, y guarda el monto/fecha de
// este pago en fabricante:last-payment (una sola entrada, se
// sobrescribe cada vez) — así la vista de solo lectura del fabricante
// puede confirmar "recibiste tu último pago" en vez de solo mostrar $0
// sin contexto. Nunca borra el historial de pedidos.
export async function markManufacturerBalancePaid() {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const [balanceRaw, ordersRaw] = await Promise.all([
      client.get(BALANCE_KEY),
      client.hgetall(ORDERS_KEY),
    ]);
    const pending = Object.entries(ordersRaw || {})
      .map(([reference, raw]) => ({ reference, ...JSON.parse(raw) }))
      .filter((o) => !o.paid);

    const amount = Number(balanceRaw) || 0;
    if (amount > 0) {
      await client.set(
        LAST_PAYMENT_KEY,
        JSON.stringify({ amount, date: new Date().toISOString() })
      );
    }

    await client.set(BALANCE_KEY, 0);

    for (const o of pending) {
      const updated = { ...o, paid: true };
      delete updated.reference;
      await client.hset(ORDERS_KEY, o.reference, JSON.stringify(updated));
    }

    return true;
  } catch (err) {
    console.error("[manufacturerFinance] No se pudo marcar el saldo como pagado:", err);
    return false;
  }
}
