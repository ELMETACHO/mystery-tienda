export const SIZES = [
  {
    id: "30x40",
    label: "30 x 40 cm",
    ratio: 30 / 40,
    minWidth: 1200,
    minHeight: 1600,
    priceCOP: 80000,
  },
  {
    id: "40x50",
    label: "40 x 50 cm",
    ratio: 40 / 50,
    minWidth: 1600,
    minHeight: 2000,
    priceCOP: 110000,
  },
  {
    id: "50x70",
    label: "50 x 70 cm",
    ratio: 50 / 70,
    minWidth: 2000,
    minHeight: 2800,
    priceCOP: 150000,
  },
];

export const ORDER_STORAGE_KEY = "mystery:pedido";

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