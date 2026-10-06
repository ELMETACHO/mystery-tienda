import { getPriceCOP } from "./order";

// "Es un regalo" (mensaje impreso, sin precio en el paquete) + tarjeta
// regalo digital. TODO apagado por defecto: solo se activa con
// NEXT_PUBLIC_GIFT_FEATURES=1 en Vercel (y un redeploy, porque las
// variables NEXT_PUBLIC_ se incrustan en el build). Con la variable
// ausente, el checkout no incluye ni un byte de este código (el
// minificador elimina la rama) y las rutas nuevas responden 404.
//
// Lógica PURA (sin Redis): probada en tests/giftFeatures.test.mjs.

export const GIFT_FEATURES_ENABLED = process.env.NEXT_PUBLIC_GIFT_FEATURES === "1";

export const GIFT_MESSAGE_MAX = 200;
export const GIFT_NAME_MAX = 60;

// Mensaje que el fabricante imprime: texto plano, sin caracteres de
// control, máximo 6 líneas y GIFT_MESSAGE_MAX caracteres. Los correos lo
// escapan con escapeHtml al mostrarlo.
export function normalizeGiftMessage(text, max = GIFT_MESSAGE_MAX) {
  if (typeof text !== "string") return "";
  return text
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .slice(0, 6)
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .slice(0, max);
}

export function normalizePersonName(text, max = GIFT_NAME_MAX) {
  if (typeof text !== "string") return "";
  return text.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

// Lo que viaja en el pedido (order.giftOption). null = no es regalo.
// Se normaliza en el navegador Y de nuevo en el servidor al armar los
// correos (el pedido llega del navegador, nunca se confía en él).
export function toGiftOption(input) {
  if (!input || input.enabled !== true) return null;
  return { enabled: true, message: normalizeGiftMessage(input.message) };
}

// ---- Tarjeta regalo ----
// Valor fijo = un cuadro 40x50 Premium al precio vigente. Se canjea con la
// infraestructura de códigos de regalo que ya existe (app/lib/giftCodes.js:
// 100% en 40x50, 1 uso, revalidado en /api/confirm-free-order) — el
// checkout no cambia nada para canjearla.
export const GIFT_CARD_SIZE_ID = "40x50";
export const GIFT_CARD_FRAME_TYPE = "premium";

export function giftCardPriceCOP() {
  return getPriceCOP(GIFT_CARD_SIZE_ID, GIFT_CARD_FRAME_TYPE);
}

export const GIFT_CARD_REFERENCE_RE = /^giftcard-\d{10,16}-[a-z0-9]{6}$/;

export function isGiftCardReference(reference) {
  return typeof reference === "string" && GIFT_CARD_REFERENCE_RE.test(reference);
}

// Código fuerte (a diferencia de REGALO#### de influencers, 9.000
// combinaciones): TARJETA-XXXX-XXXX con 31 símbolos sin ambiguos
// (sin 0/O/1/I/L) ≈ 8,5e11 combinaciones. `randomBytes` se inyecta para
// poder probarlo.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function generateGiftCardCode(randomBytes) {
  const bytes = randomBytes(8);
  let chars = "";
  for (let i = 0; i < 8; i++) chars += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `TARJETA-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export function isValidEmail(email) {
  return typeof email === "string" && email.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email);
}

// Verificación del pago de una tarjeta regalo: la transacción de Wompi
// (consultada server-side o recibida por el webhook con checksum válido)
// debe estar APROBADA, en COP, con la MISMA referencia y el MISMO monto
// que el servidor guardó al iniciar la compra.
export function verifyGiftCardTransaction(transaction, purchase) {
  if (!transaction || !purchase) return { ok: false, reason: "missing" };
  if (transaction.status !== "APPROVED") return { ok: false, reason: "not-approved" };
  if (transaction.reference !== purchase.reference) return { ok: false, reason: "reference" };
  if (transaction.currency !== "COP") return { ok: false, reason: "currency" };
  if (Number(transaction.amount_in_cents) !== Number(purchase.amountInCents)) {
    return { ok: false, reason: "amount" };
  }
  return { ok: true };
}
