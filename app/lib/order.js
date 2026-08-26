// packageCm/weightKg: dimensiones de envío reales (caja con el cuadro
// sobre madera) y peso — punto medio del rango confirmado por el negocio.
// Usados para cotizar/crear guías con Skydropx (ver app/lib/skydropx.js).
// Estos valores son los mismos para Premium y Tradicional (mismo tamaño
// físico de caja); el precio y la comisión al fabricante sí dependen del
// frameType — ver FRAME_TYPES y PRICES más abajo.
export const SIZES = [
  {
    id: "30x40",
    label: "30 x 40 cm",
    ratio: 30 / 40,
    minWidth: 1200,
    minHeight: 1600,
    packageCm: { length: 35, width: 45, height: 5 },
    weightKg: 1.0,
  },
  {
    id: "40x50",
    label: "40 x 50 cm",
    ratio: 40 / 50,
    minWidth: 1600,
    minHeight: 2000,
    packageCm: { length: 45, width: 55, height: 5 },
    weightKg: 1.5,
  },
  {
    id: "50x70",
    label: "50 x 70 cm",
    ratio: 50 / 70,
    minWidth: 2000,
    minHeight: 2800,
    packageCm: { length: 55, width: 75, height: 5 },
    weightKg: 2.15,
  },
];

// Tipos de cuadro (agosto 2026): Premium (con marco trasero de 3cm,
// fabricado por Daniela, comisión fija $15.000 sin importar el tamaño) y
// Tradicional (sin marco, más delgado, con soporte para colgar, lo fabrica
// el dueño mismo — comisión $0). "premium" es el default para compatibilidad
// con pedidos/UI que aún no seleccionan frameType explícitamente.
export const FRAME_TYPES = {
  premium: {
    id: "premium",
    label: "Premium",
    description: "Con marco trasero de 3cm",
    fabricanteId: "daniela",
    commissionCOP: 15000,
  },
  tradicional: {
    id: "tradicional",
    label: "Tradicional",
    description: "Más delgado, con soporte para colgar",
    fabricanteId: "oscar",
    commissionCOP: 0,
  },
};

export const DEFAULT_FRAME_TYPE = "premium";

// Precios definitivos por tipo de cuadro + tamaño (agosto 2026).
export const PRICES = {
  premium: { "30x40": 65000, "40x50": 89000, "50x70": 149000 },
  tradicional: { "30x40": 55000, "40x50": 75000, "50x70": 120000 },
};

export function getPriceCOP(sizeId, frameType = DEFAULT_FRAME_TYPE) {
  return PRICES[frameType]?.[sizeId] ?? PRICES[DEFAULT_FRAME_TYPE][sizeId];
}

export function getFabricanteCommissionCOP(frameType = DEFAULT_FRAME_TYPE) {
  return (FRAME_TYPES[frameType] ?? FRAME_TYPES[DEFAULT_FRAME_TYPE]).commissionCOP;
}

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