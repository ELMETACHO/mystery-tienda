// Mensaje de fecha límite de Navidad (dato del dueño, oct 2026: producción
// 1-2 días y máximo 5 días desde el pedido hasta el cliente en Colombia).
// Un solo lugar para cambiarlo o apagarlo:
// - `enabled: false` lo apaga ya en todas las páginas.
// - `showUntil` lo apaga solo pasada esa fecha (hora Colombia), así no
//   queda una promesa vencida en la página si nadie se acuerda de quitarlo.
// Para la próxima Navidad: actualizar `message` y `showUntil` (el resto de
// las páginas de Navidad sirven igual todo el año).
export const CHRISTMAS_DEADLINE = {
  enabled: true,
  message: "Pide hasta el 17 de diciembre para recibir antes del 24",
  showUntil: "2026-12-17T23:59:59-05:00",
};

export function isChristmasDeadlineActive(now = new Date()) {
  if (!CHRISTMAS_DEADLINE.enabled) return false;
  return now <= new Date(CHRISTMAS_DEADLINE.showUntil);
}
