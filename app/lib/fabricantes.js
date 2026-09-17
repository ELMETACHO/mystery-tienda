import { FRAME_TYPES } from "./order";

// Configuración de los dos fabricantes independientes (agosto 2026):
// - "daniela" produce Premium (con marco trasero), comisión fija $15.000.
// - "oscar" produce Tradicional (sin marco), comisión fija $10.000.
// Ambos ids internos se quedaron con sus nombres originales (Daniela y
// Oscar-dueño ya no fabrican nada — ver CLAUDE.md) para no romper el
// fabricanteId ya guardado en pedidos/pagos históricos; correo y código
// de acceso sí apuntan al fabricante real actual.
//
// Desde sept 2026 AMBOS los fabrica Cristhian, con el MISMO código de
// acceso (accessCode) a propósito — así entra una sola vez a /fabricante
// y ve las dos colas (Premium/Tradicional) como pestañas separadas, en
// vez de tener que salir y volver a entrar con un código distinto por
// cada una (ver getFabricantesByAccessCode abajo y app/fabricante/page.js).
// Los saldos y correos de "nuevo pedido" siguen 100% separados por
// fabricanteId — compartir el código de entrada no mezcla la plata de
// cada cola.
export const FABRICANTES = {
  daniela: {
    id: "daniela",
    label: "Premium",
    frameType: "premium",
    email: process.env.FABRICANTE_EMAIL_PREMIUM,
    accessCode: process.env.FABRICANTE_ACCESS_CODE_PREMIUM,
  },
  oscar: {
    id: "oscar",
    label: "Tradicional",
    frameType: "tradicional",
    email: process.env.FABRICANTE_EMAIL_TRADICIONAL,
    // Mismo código que Premium a propósito — ver comentario grande
    // arriba. FABRICANTE_ACCESS_CODE_TRADICIONAL queda sin uso (se deja
    // definida por si se necesita separar de nuevo en el futuro).
    accessCode: process.env.FABRICANTE_ACCESS_CODE_PREMIUM,
  },
};

export function getFabricanteForFrameType(frameType) {
  const entry = Object.values(FABRICANTES).find((f) => f.frameType === frameType);
  return entry || FABRICANTES[FRAME_TYPES.premium.fabricanteId];
}

// Resuelve el/los fabricante(s) que corresponden a un código de acceso
// ingresado en /fabricante — puede devolver más de uno si el código es
// compartido (ver comentario grande arriba). Usado por
// /api/fabricante-status para autenticar y armar una pestaña por cada
// fabricante que le corresponda a ese código. Nunca confiar en un
// fabricanteId que venga suelto del cliente sin pasar por acá primero.
export function getFabricantesByAccessCode(code) {
  if (!code) return [];
  return Object.values(FABRICANTES).filter((f) => f.accessCode && f.accessCode === code);
}

// Variante de un solo resultado, para las acciones (cancelar/generar
// guía) que además reciben una `reference` de pedido puntual: prueban
// cada fabricante que el código habilite hasta encontrar el que
// realmente tiene ese pedido (ver los 3 usos en app/api/fabricante-*).
export function getFabricanteByAccessCode(code) {
  return getFabricantesByAccessCode(code)[0] || null;
}
