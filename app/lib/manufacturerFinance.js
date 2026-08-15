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
export async function recordManufacturerOrder({ reference, order, customer, guideUrl }) {
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

// Agrega una entrada al CRM (crm:entries) — datos de contacto/compra del
// cliente, independientes del saldo del fabricante (no toca
// fabricante:balance/fabricante:orders). Nunca lanza.
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

  const entry = {
    nombre: customer.fullName,
    telefono: `${customer.phonePrefix || ""}${customer.phone || ""}`,
    direccion,
    correo: customer.email,
    sizeId: order.sizeId,
    metodoPago,
    cuponOReferido,
    fecha,
    totalHistorico,
  };

  try {
    await client.rpush(CRM_KEY, JSON.stringify(entry));
  } catch (err) {
    console.error("[manufacturerFinance] No se pudo registrar la entrada CRM en Redis:", err);
  }
}

// Para /admin/finanzas y /finanzas/fabricante: saldo total + pedidos
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
