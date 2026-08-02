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

export function saveOrder(order) {
  sessionStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
}

export function loadOrder() {
  const raw = sessionStorage.getItem(ORDER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}