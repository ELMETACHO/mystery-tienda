import { FRAME_TYPES } from "./order";

// Configuración de los dos fabricantes independientes (agosto 2026):
// - "daniela" produce Premium (con marco trasero), comisión fija $15.000.
// - "oscar" produce Tradicional (sin marco), comisión $0 — es el dueño
//   mismo, lo fabrica él.
// El correo/código de acceso de cada uno vive en variables de entorno
// (agregar también en Vercel, ver CLAUDE.md) para no hardcodear datos de
// contacto reales en el código.
export const FABRICANTES = {
  daniela: {
    id: "daniela",
    frameType: "premium",
    email: process.env.FABRICANTE_EMAIL_PREMIUM,
    accessCode: process.env.FABRICANTE_ACCESS_CODE_PREMIUM,
  },
  oscar: {
    id: "oscar",
    frameType: "tradicional",
    email: process.env.FABRICANTE_EMAIL_TRADICIONAL,
    accessCode: process.env.FABRICANTE_ACCESS_CODE_TRADICIONAL,
  },
};

export function getFabricanteForFrameType(frameType) {
  const entry = Object.values(FABRICANTES).find((f) => f.frameType === frameType);
  return entry || FABRICANTES[FRAME_TYPES.premium.fabricanteId];
}

// Resuelve qué fabricante corresponde a un código de acceso ingresado en
// /fabricante — usado por /api/fabricante-status para autenticar Y saber a
// cuál fabricante limitar todas las lecturas/escrituras subsecuentes del
// panel. Nunca confiar en un fabricanteId que venga suelto del cliente sin
// pasar por acá primero.
export function getFabricanteByAccessCode(code) {
  if (!code) return null;
  return Object.values(FABRICANTES).find((f) => f.accessCode && f.accessCode === code) || null;
}
