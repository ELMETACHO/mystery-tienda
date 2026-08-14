import Redis from "ioredis";
import { SIZES, formatCOP } from "./order";
import { appendRow, updateCell } from "./googleSheets";
import { getOrderCount } from "./loyalty";

// Fuente de verdad real del saldo pendiente al fabricante: Redis.
// Google Sheets (ver scripts/create-finance-sheet.mjs) es solo una vista
// espejo para que el fabricante/CRM la revisen a mano — si escribir en
// Sheets falla, el pedido y el saldo en Redis ya quedaron registrados
// igual (nunca se bloquea la confirmación del pago por esto).
//
// fabricante:balance -> string numérico, saldo total pendiente en COP.
// fabricante:orders  -> hash, field=reference, value=JSON del pedido
// (cliente, ciudad, tamaño, monto, fecha, paid, sheetRow — sheetRow es
// la fila real en la pestaña "Fabricante" del Sheet, para poder marcar
// "Pagado" ahí sin tener que buscar la fila por contenido).

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

function sizeLabel(sizeId) {
  return SIZES.find((s) => s.id === sizeId)?.label || sizeId;
}

function fabricanteCost(sizeId) {
  return SIZES.find((s) => s.id === sizeId)?.fabricanteCostCOP || 0;
}

const FABRICANTE_SHEET = process.env.GOOGLE_SHEETS_FINANCE_ID
  ? { spreadsheetId: process.env.GOOGLE_SHEETS_FINANCE_ID, sheetName: "Fabricante" }
  : null;
const CRM_SHEET = process.env.GOOGLE_SHEETS_FINANCE_ID
  ? { spreadsheetId: process.env.GOOGLE_SHEETS_FINANCE_ID, sheetName: "CRM" }
  : null;

// Registra el pedido en fabricante:orders + suma el costo al balance, y
// espeja la fila en la pestaña "Fabricante" del Sheet (incluida la
// columna "Guía" con el link de la etiqueta, como segunda forma de
// validación manual junto al Estado).
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

  try {
    await client.incrby(BALANCE_KEY, monto);

    const record = {
      reference,
      cliente: customer.fullName,
      ciudad: customer.city,
      sizeId: order.sizeId,
      monto,
      fecha,
      guideUrl: guideUrl || null,
      paid: false,
      sheetRow: null,
    };
    await client.hset(ORDERS_KEY, reference, JSON.stringify(record));

    if (FABRICANTE_SHEET) {
      const sheetRow = await appendRow({
        ...FABRICANTE_SHEET,
        values: [
          customer.fullName,
          customer.city,
          sizeLabel(order.sizeId),
          formatCOP(monto),
          fecha,
          "Pendiente",
          guideUrl || "",
        ],
      });
      record.sheetRow = sheetRow;
      await client.hset(ORDERS_KEY, reference, JSON.stringify(record));
    }
  } catch (err) {
    console.error(
      "[manufacturerFinance] No se pudo registrar el pedido del fabricante:",
      err
    );
  }
}

// Agrega la fila correspondiente en la pestaña "CRM" — datos de
// contacto/compra del cliente, independientes del saldo del fabricante
// (no toca Redis, solo Sheets). Nunca lanza.
export async function recordCrmEntry({ order, customer, paymentMethod }) {
  if (!CRM_SHEET) {
    console.error(
      "[manufacturerFinance] GOOGLE_SHEETS_FINANCE_ID no está configurado; no se registró la fila CRM."
    );
    return;
  }

  try {
    const totalHistorico = await getOrderCount(customer.email);
    const direccion = [
      customer.street,
      customer.neighborhood,
      customer.city,
      customer.department,
    ]
      .filter(Boolean)
      .join(", ");
    const metodoPago = paymentMethod === "cod" ? "Contraentrega" : "Pago completo";
    const cuponOReferido = order.discountCode || order.referralCode || "";

    await appendRow({
      ...CRM_SHEET,
      values: [
        customer.fullName,
        `${customer.phonePrefix || ""}${customer.phone || ""}`,
        direccion,
        customer.email,
        sizeLabel(order.sizeId),
        metodoPago,
        cuponOReferido,
        new Date().toISOString(),
        totalHistorico,
      ],
    });
  } catch (err) {
    console.error("[manufacturerFinance] No se pudo registrar la fila CRM:", err);
  }
}

// Para /api/admin-list: saldo total + pedidos pendientes de pago,
// más recientes primero.
export async function getManufacturerPendingOrders() {
  const client = getRedisClient();
  if (!client) return { balance: 0, orders: [] };

  try {
    const [balanceRaw, ordersRaw] = await Promise.all([
      client.get(BALANCE_KEY),
      client.hgetall(ORDERS_KEY),
    ]);

    const orders = Object.values(ordersRaw || {})
      .map((raw) => JSON.parse(raw))
      .filter((o) => !o.paid)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    return { balance: Number(balanceRaw) || 0, orders };
  } catch (err) {
    console.error("[manufacturerFinance] No se pudo leer el saldo del fabricante:", err);
    return { balance: 0, orders: [] };
  }
}

// Botón "✅ Ya pagué todo": resetea el balance a 0, marca todos los
// pedidos pendientes como paid:true en Redis, y actualiza la columna
// Estado a "Pagado" en la pestaña Fabricante del Sheet (columna F, ver
// FABRICANTE_HEADERS en create-finance-sheet.mjs) — nunca borra filas,
// mantiene el historial completo.
export async function markManufacturerBalancePaid() {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const ordersRaw = await client.hgetall(ORDERS_KEY);
    const pending = Object.entries(ordersRaw || {})
      .map(([reference, raw]) => ({ reference, ...JSON.parse(raw) }))
      .filter((o) => !o.paid);

    await client.set(BALANCE_KEY, 0);

    for (const o of pending) {
      const updated = { ...o, paid: true };
      delete updated.reference;
      await client.hset(ORDERS_KEY, o.reference, JSON.stringify(updated));
    }

    if (FABRICANTE_SHEET) {
      await Promise.all(
        pending
          .filter((o) => o.sheetRow)
          .map((o) =>
            updateCell({
              ...FABRICANTE_SHEET,
              column: "F",
              row: o.sheetRow,
              value: "Pagado",
            }).catch((err) =>
              console.error(
                `[manufacturerFinance] No se pudo actualizar Estado en fila ${o.sheetRow}:`,
                err
              )
            )
          )
      );
    }

    return true;
  } catch (err) {
    console.error("[manufacturerFinance] No se pudo marcar el saldo como pagado:", err);
    return false;
  }
}
