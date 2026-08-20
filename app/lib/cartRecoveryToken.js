import { createHmac, timingSafeEqual } from "crypto";

// Token del link de recuperación de carrito (/checkout?resume=...&token=...)
// SIN estado, mismo principio que reviewToken.js: se deriva de forma
// determinística con HMAC-SHA256 sobre el `reference` + un secreto que
// solo conoce el servidor (CART_RECOVERY_TOKEN_SECRET) — nadie puede
// forjar un link para un `reference` ajeno sin conocer el secreto, y no
// hace falta guardar/expirar tokens aparte en Redis (el pending-order en
// sí ya expira solo por su propio TTL).

function getSecret() {
  const secret = process.env.CART_RECOVERY_TOKEN_SECRET;
  if (!secret) {
    throw new Error("Falta CART_RECOVERY_TOKEN_SECRET en las variables de entorno.");
  }
  return secret;
}

export function generateCartRecoveryToken(reference) {
  return createHmac("sha256", getSecret())
    .update(reference)
    .digest("base64url");
}

// Comparación en tiempo constante — mismo motivo que reviewToken.js.
export function isValidCartRecoveryToken(reference, token) {
  if (!reference || !token) return false;

  let expected;
  try {
    expected = generateCartRecoveryToken(reference);
  } catch (err) {
    console.error("[cartRecoveryToken] No se pudo generar el token esperado:", err);
    return false;
  }

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(token);

  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
