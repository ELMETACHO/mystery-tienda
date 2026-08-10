import { createHmac, timingSafeEqual } from "crypto";

// Token del link de reseña (/resena?ref=...&token=...) SIN estado: en
// vez de generar un token random y guardarlo en otra tabla para poder
// validarlo después, se deriva de forma determinística con HMAC-SHA256
// sobre el `reference` + un secreto que solo conoce el servidor
// (REVIEW_TOKEN_SECRET). Para validar, el servidor simplemente
// recalcula el HMAC y compara — nadie puede forjar un link para un
// `reference` ajeno sin conocer el secreto, y no hace falta "gastar"
// ni expirar tokens en Redis.

function getSecret() {
  const secret = process.env.REVIEW_TOKEN_SECRET;
  if (!secret) {
    throw new Error("Falta REVIEW_TOKEN_SECRET en las variables de entorno.");
  }
  return secret;
}

export function generateReviewToken(reference) {
  return createHmac("sha256", getSecret())
    .update(reference)
    .digest("base64url");
}

// Comparación en tiempo constante (timingSafeEqual) en vez de === —
// evita que alguien pueda inferir el token correcto byte a byte
// midiendo cuánto tarda la comparación (timing attack). Ambos buffers
// deben tener el mismo largo para timingSafeEqual; si no coinciden,
// ya es inválido de una.
export function isValidReviewToken(reference, token) {
  if (!reference || !token) return false;

  let expected;
  try {
    expected = generateReviewToken(reference);
  } catch (err) {
    console.error("[reviewToken] No se pudo generar el token esperado:", err);
    return false;
  }

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(token);

  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
