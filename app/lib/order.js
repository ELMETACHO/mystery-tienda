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
  // Tamaños grandes (sept 2026). Solo Premium (sin marco trasero se
  // doblarían), solo en /crear y /ads — NO en el catálogo (/estudio,
  // /producto): ver CATALOG_SIZES abajo. Paquete 5cm más grande por lado
  // que el cuadro (mismo criterio que los demás) — el 100x140 se cotizó
  // así con un pedido real a Barranquilla. maxShippingCOP: tope de costo de
  // guía propio, en vez de MAX_SHIPPING_COST_COP (skydropx.js), porque a
  // este tamaño ningún envío baja de ~$25.000.
  {
    id: "70x100",
    label: "70 x 100 cm",
    ratio: 70 / 100,
    minWidth: 2800,
    minHeight: 4000,
    packageCm: { length: 75, width: 105, height: 8 },
    weightKg: 6,
    premiumOnly: true,
    customOnly: true,
    maxShippingCOP: 60000,
  },
  {
    id: "100x140",
    label: "100 x 140 cm",
    ratio: 100 / 140,
    minWidth: 4000,
    minHeight: 5600,
    packageCm: { length: 105, width: 145, height: 8 },
    weightKg: 10,
    premiumOnly: true,
    customOnly: true,
    maxShippingCOP: 60000,
  },
];

// Tamaños que vende el catálogo (/estudio hornea un archivo por cada uno,
// /producto/[id] los ofrece). Los customOnly no están: los diseños ya
// subidos no tienen archivo para esos tamaños.
export const CATALOG_SIZES = SIZES.filter((s) => !s.customOnly);

export function isPremiumOnlySize(sizeId) {
  return Boolean(SIZES.find((s) => s.id === sizeId)?.premiumOnly);
}

// Tipos de cuadro (agosto 2026): Premium (con marco trasero de 3cm,
// fabricado por Cristhian —antes Daniela, ver fabricantes.js—, comisión
// fija $15.000 sin importar el tamaño) y
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
    // Antes $0 (lo fabricaba el dueño mismo). Desde sept 2026, Cristhian
    // también fabrica Tradicional por una comisión fija de $10.000 COP
    // sin importar el tamaño (igual que Premium, pero con su propio
    // monto) — el dueño sigue comprando el vinilo/madera, esta comisión
    // es solo por la fabricación.
    commissionCOP: 10000,
  },
};

export const DEFAULT_FRAME_TYPE = "premium";

// Precios definitivos por tipo de cuadro + tamaño (agosto 2026).
// 70x100 y 100x140 (sept 2026) solo existen en Premium.
export const PRICES = {
  premium: { "30x40": 65000, "40x50": 89000, "50x70": 149000, "70x100": 249000, "100x140": 350000 },
  tradicional: { "30x40": 55000, "40x50": 75000, "50x70": 120000 },
};

export function getPriceCOP(sizeId, frameType = DEFAULT_FRAME_TYPE) {
  return PRICES[frameType]?.[sizeId] ?? PRICES[DEFAULT_FRAME_TYPE][sizeId];
}

// Comisión de Cris por tamaño grande (acordada con Oscar, sept 2026) — los
// demás tamaños siguen con la comisión fija de su FRAME_TYPE.
const SIZE_COMMISSION_OVERRIDES_COP = { "70x100": 25000, "100x140": 30000 };

export function getFabricanteCommissionCOP(frameType = DEFAULT_FRAME_TYPE, sizeId) {
  return (
    SIZE_COMMISSION_OVERRIDES_COP[sizeId] ??
    (FRAME_TYPES[frameType] ?? FRAME_TYPES[DEFAULT_FRAME_TYPE]).commissionCOP
  );
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