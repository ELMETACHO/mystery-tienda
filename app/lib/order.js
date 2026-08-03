// packageCm/weightKg: dimensiones de envío reales (caja con el cuadro
// sobre madera, marco trasero de ~3cm incluido) y peso — punto medio del
// rango confirmado por el negocio. Usados para cotizar/crear guías con
// Skydropx (ver app/lib/skydropx.js).
export const SIZES = [
  {
    id: "30x40",
    label: "30 x 40 cm",
    ratio: 30 / 40,
    minWidth: 1200,
    minHeight: 1600,
    priceCOP: 80000,
    packageCm: { length: 35, width: 45, height: 5 },
    weightKg: 1.0,
  },
  {
    id: "40x50",
    label: "40 x 50 cm",
    ratio: 40 / 50,
    minWidth: 1600,
    minHeight: 2000,
    priceCOP: 110000,
    packageCm: { length: 45, width: 55, height: 5 },
    weightKg: 1.5,
  },
  {
    id: "50x70",
    label: "50 x 70 cm",
    ratio: 50 / 70,
    minWidth: 2000,
    minHeight: 2800,
    priceCOP: 150000,
    packageCm: { length: 55, width: 75, height: 5 },
    weightKg: 2.15,
  },
];

export const ORDER_STORAGE_KEY = "mystery:pedido";

// Anticipo fijo para "Pago contraentrega": cubre costos de producción por
// adelantado vía Wompi; el resto (priceCOP - COD_DEPOSIT_COP) se paga en
// efectivo al recibir el cuadro.
export const COD_DEPOSIT_COP = 20000;

export function formatCOP(amount) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

// El pedido completo (incluida la imagen final en base64, que puede pesar
// varios MB) se guarda en IndexedDB vía idb-keyval en lugar de sessionStorage:
// sessionStorage tiene un límite de ~5-10MB por origen y lanza
// QuotaExceededError con fotos de buena resolución.
export async function saveOrder(order) {
  const { set } = await import("idb-keyval");
  await set(ORDER_STORAGE_KEY, order);
}

export async function loadOrder() {
  const { get } = await import("idb-keyval");
  const order = await get(ORDER_STORAGE_KEY);
  return order ?? null;
}