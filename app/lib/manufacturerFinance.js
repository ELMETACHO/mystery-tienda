import Redis from "ioredis";
import { SIZES, FRAME_TYPES, getFabricanteCommissionCOP } from "./order";
import { getOrderCount } from "./loyalty";

// Fuente de verdad única del saldo pendiente a cada fabricante y del CRM:
// Redis (ya no se espeja nada en Google Sheets).
//
// Claves indexadas por fabricanteId ("daniela" | "oscar", ver FRAME_TYPES en
// app/lib/order.js) desde agosto 2026 (Premium/Tradicional, dos
// fabricantes independientes) — antes de este cambio existía una única
// clave global; no había datos reales que migrar (todo era pruebas), así
// que se cortó limpio y ambos paneles arrancan en $0.
//
// fabricante:<id>:balance -> string numérico, saldo total pendiente en COP.
// fabricante:<id>:orders  -> hash, field=reference, value=JSON del pedido
// (cliente, ciudad, tamaño, monto, fecha, guideUrl, paid).
// fabricante:<id>:payouts -> lista, cada elemento {amount, date} — historial
// completo de pagos ya hechos (ver markManufacturerBalancePaid), más
// antiguo primero.
// crm:entries -> lista, cada elemento es el JSON de una entrada CRM
// (nombre, teléfono, dirección, correo, tamaño, método de pago,
// cupón/referido, fecha, total histórico de compras), más reciente al
// final (se lee con lrange + reverse) — global, no depende del fabricante.

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

export const FABRICANTE_IDS = Object.values(FRAME_TYPES).map((t) => t.fabricanteId);

function assertFabricanteId(fabricanteId) {
  if (!FABRICANTE_IDS.includes(fabricanteId)) {
    throw new Error(`fabricanteId desconocido: ${fabricanteId}`);
  }
}

function balanceKey(fabricanteId) {
  return `fabricante:${fabricanteId}:balance`;
}
function ordersKey(fabricanteId) {
  return `fabricante:${fabricanteId}:orders`;
}
function payoutsKey(fabricanteId) {
  return `fabricante:${fabricanteId}:payouts`;
}
const CRM_KEY = "crm:entries";

function sizeLabel(sizeId) {
  return SIZES.find((s) => s.id === sizeId)?.label || sizeId;
}

// Registra el pedido en fabricante:<id>:orders + suma la comisión al
// balance de ese fabricante. El fabricanteId se resuelve a partir de
// order.frameType (ver getFabricanteForFrameType en app/lib/fabricantes.js).
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
  fabricanteId,
  reference,
  order,
  customer,
  guideUrl,
  shipmentId,
  trackingNumber,
  carrierName,
  shippingCostCOP,
}) {
  const client = getRedisClient();
  if (!client) {
    console.error(
      "[manufacturerFinance] REDIS_URL no está configurado; no se registró el pedido del fabricante."
    );
    return;
  }
  try {
    assertFabricanteId(fabricanteId);
  } catch (err) {
    console.error("[manufacturerFinance]", err.message);
    return;
  }

  // La comisión es fija por tipo de cuadro (Premium=$15.000, Tradicional=$0),
  // no por tamaño — ver getFabricanteCommissionCOP en app/lib/order.js.
  const monto = getFabricanteCommissionCOP(order.frameType);
  const fecha = new Date().toISOString();

  const record = {
    reference,
    cliente: customer.fullName,
    ciudad: customer.city,
    sizeId: order.sizeId,
    frameType: order.frameType,
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
    // Costo real que cobró Skydropx por esta guía (ver
    // app/lib/skydropx.js) — gasto automático que se suma en el reporte
    // financiero de /admin/reporte ("Costo de envío"), sin que el admin
    // tenga que anotarlo a mano.
    shippingCostCOP: shippingCostCOP ?? null,
    // "activo" | "cancelado" — ver markManufacturerOrderCancelled y
    // markManufacturerOrderRegenerated. Los registros creados antes de
    // este campo no lo tienen; se tratan como "activo" por defecto (ver
    // app/fabricante/page.js: `o.status || "activo"`).
    status: "activo",
    cancelReason: null,
    cancelledAt: null,
    paid: monto === 0, // comisión $0 (Tradicional) nunca queda "pendiente de pago"
  };

  try {
    if (monto > 0) {
      await client.incrby(balanceKey(fabricanteId), monto);
    }
    await client.hset(ordersKey(fabricanteId), reference, JSON.stringify(record));
  } catch (err) {
    console.error(
      "[manufacturerFinance] No se pudo registrar el pedido del fabricante en Redis:",
      err
    );
  }
}

// Lee un solo pedido de fabricante:<id>:orders por reference — usado por los
// botones "Cancelar guía"/"Generar guía nueva" del panel del fabricante
// (ver app/api/fabricante-cancel-shipment y
// app/api/fabricante-generate-shipment) para validar el estado actual
// antes de actuar.
export async function getManufacturerOrder(fabricanteId, reference) {
  const client = getRedisClient();
  if (!client || !reference) return null;

  try {
    assertFabricanteId(fabricanteId);
    const raw = await client.hget(ordersKey(fabricanteId), reference);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("[manufacturerFinance] No se pudo leer el pedido del fabricante:", err);
    return null;
  }
}

// Botón "Cancelar guía" del panel del fabricante: marca el pedido como
// "cancelado" (NUNCA lo borra — se conserva el historial completo, motivo
// incluido) y resta su monto de fabricante:<id>:balance, ya que sin guía real
// no hay evidencia de que el cuadro se vaya a entregar. Solo resta si el
// pedido seguía sin pagar (si el admin ya lo había marcado paid, ya salió
// del balance pendiente antes, y no hay que tocarlo de nuevo). Devuelve
// el registro actualizado, o null si no existía o Redis falla.
export async function markManufacturerOrderCancelled({ fabricanteId, reference, reason }) {
  const client = getRedisClient();
  if (!client || !reference) return null;

  try {
    assertFabricanteId(fabricanteId);
    const raw = await client.hget(ordersKey(fabricanteId), reference);
    if (!raw) return null;

    const record = JSON.parse(raw);
    const updated = {
      ...record,
      status: "cancelado",
      cancelReason: reason,
      cancelledAt: new Date().toISOString(),
      // Skydropx reembolsa el costo de la guía al cancelarla (confirmado
      // en vivo: payment_status pasa a "refunded") — ya no es un gasto
      // real, así que se limpia acá para que el reporte financiero no lo
      // siga sumando (ver app/lib/financeReport.js, que además filtra
      // por status !== "cancelado" como red de seguridad extra).
      shippingCostCOP: null,
    };
    await client.hset(ordersKey(fabricanteId), reference, JSON.stringify(updated));
    if (!record.paid) {
      await client.decrby(balanceKey(fabricanteId), record.monto);
    }
    return updated;
  } catch (err) {
    console.error("[manufacturerFinance] No se pudo cancelar el pedido del fabricante:", err);
    return null;
  }
}

// Botón "Generar guía nueva" (solo visible para pedidos "cancelado"):
// actualiza el registro con los datos de la guía REAL nueva y vuelve a
// sumar el monto a fabricante:<id>:balance — ahora sí hay una guía real de
// nuevo, así que vuelve a ser una deuda real (mismo criterio que
// recordManufacturerOrder). Solo suma si el pedido sigue sin pagar (ver
// markManufacturerOrderCancelled).
export async function markManufacturerOrderRegenerated({
  fabricanteId,
  reference,
  guideUrl,
  shipmentId,
  trackingNumber,
  carrierName,
  shippingCostCOP,
}) {
  const client = getRedisClient();
  if (!client || !reference) return null;

  try {
    assertFabricanteId(fabricanteId);
    const raw = await client.hget(ordersKey(fabricanteId), reference);
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
      shippingCostCOP: shippingCostCOP ?? null,
    };
    await client.hset(ordersKey(fabricanteId), reference, JSON.stringify(updated));
    if (!record.paid) {
      await client.incrby(balanceKey(fabricanteId), record.monto);
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
// (no toca fabricante:<id>:balance/fabricante:<id>:orders, y no depende
// de frameType: es global a la tienda). Nunca lanza.
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
    frameType: order.frameType,
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

// TODOS los pedidos de UN fabricante (pagados o no, activos o cancelados)
// — a diferencia de getManufacturerPendingOrders (que solo trae los sin
// pagar), esto lo usa el reporte financiero de /admin/reporte para sumar
// shippingCostCOP por rango de fechas sin importar si ya se le pagó al
// fabricante o no (son cosas independientes). Nunca lanza.
export async function getAllManufacturerOrders(fabricanteId) {
  const client = getRedisClient();
  if (!client) return [];

  try {
    assertFabricanteId(fabricanteId);
    const ordersRaw = await client.hgetall(ordersKey(fabricanteId));
    return Object.values(ordersRaw || {}).map((raw) => JSON.parse(raw));
  } catch (err) {
    console.error("[manufacturerFinance] No se pudieron leer todos los pedidos:", err);
    return [];
  }
}

// Combina getAllManufacturerOrders() de TODOS los fabricantes — usado por
// /admin/reporte para el total general de costos de fabricación/envío sin
// importar el tipo de cuadro.
export async function getAllManufacturerOrdersCombined() {
  const results = await Promise.all(FABRICANTE_IDS.map((id) => getAllManufacturerOrders(id)));
  return results.flat();
}

// Todo el historial de pagos a UN fabricante, en el orden en que se
// hicieron (más antiguo primero — mismo orden que payouts en
// referrals.js). Usado por getManufacturerPendingOrders (para derivar
// "el último pago") y por el reporte financiero de /admin/reporte (para
// sumar pagos dentro de un rango de fechas). Nunca lanza.
export async function getManufacturerPayouts(fabricanteId) {
  const client = getRedisClient();
  if (!client) return [];

  try {
    assertFabricanteId(fabricanteId);
    const raw = await client.lrange(payoutsKey(fabricanteId), 0, -1);
    return raw.map((r) => JSON.parse(r));
  } catch (err) {
    console.error("[manufacturerFinance] No se pudo leer el historial de pagos:", err);
    return [];
  }
}

// Para /admin/finanzas y /fabricante: saldo total + pedidos
// pendientes de pago (más recientes primero) + el último pago del
// historial (ver getManufacturerPayouts) de UN fabricante — así la vista
// de solo lectura del fabricante puede mostrar "recibiste tu último pago"
// cuando el saldo está en $0, en vez de un silencio sin explicación.
export async function getManufacturerPendingOrders(fabricanteId) {
  const client = getRedisClient();
  if (!client) return { balance: 0, orders: [], lastPayment: null };

  try {
    assertFabricanteId(fabricanteId);
    const [balanceRaw, ordersRaw, payouts] = await Promise.all([
      client.get(balanceKey(fabricanteId)),
      client.hgetall(ordersKey(fabricanteId)),
      getManufacturerPayouts(fabricanteId),
    ]);

    const orders = Object.values(ordersRaw || {})
      .map((raw) => JSON.parse(raw))
      .filter((o) => !o.paid)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    return {
      balance: Number(balanceRaw) || 0,
      orders,
      lastPayment: payouts.length > 0 ? payouts[payouts.length - 1] : null,
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

// Botón "✅ Ya pagué todo" en el panel de UN fabricante: resetea SU
// balance a 0, marca SUS pedidos pendientes como paid:true en Redis, y
// agrega una entrada a SU historial completo de pagos
// (fabricante:<id>:payouts, ver getManufacturerPayouts) — SIN perder los
// pagos anteriores. Nunca borra el historial de pedidos. No afecta al
// otro fabricante.
export async function markManufacturerBalancePaid(fabricanteId) {
  const client = getRedisClient();
  if (!client) return false;

  try {
    assertFabricanteId(fabricanteId);
    const [balanceRaw, ordersRaw] = await Promise.all([
      client.get(balanceKey(fabricanteId)),
      client.hgetall(ordersKey(fabricanteId)),
    ]);
    const pending = Object.entries(ordersRaw || {})
      .map(([reference, raw]) => ({ reference, ...JSON.parse(raw) }))
      .filter((o) => !o.paid);

    const amount = Number(balanceRaw) || 0;
    if (amount > 0) {
      await client.rpush(
        payoutsKey(fabricanteId),
        JSON.stringify({ amount, date: new Date().toISOString() })
      );
    }

    await client.set(balanceKey(fabricanteId), 0);

    for (const o of pending) {
      const updated = { ...o, paid: true };
      delete updated.reference;
      await client.hset(ordersKey(fabricanteId), o.reference, JSON.stringify(updated));
    }

    return true;
  } catch (err) {
    console.error("[manufacturerFinance] No se pudo marcar el saldo como pagado:", err);
    return false;
  }
}
