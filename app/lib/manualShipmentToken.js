import { createHmac, timingSafeEqual } from "crypto";

// Token del link "generar guía ahora" (/api/generate-shipment?ref=...&token=...)
// en el correo al fabricante. Mismo patrón SIN ESTADO que
// app/lib/reviewToken.js: HMAC-SHA256 sobre el `reference` + un secreto que
// solo conoce el servidor (MANUAL_SHIPMENT_TOKEN_SECRET) — nadie puede
// forjar un link para un `reference` ajeno sin conocer el secreto, y no
// hace falta gestionar/expirar tokens aparte en Redis.

function getSecret() {
  const secret = process.env.MANUAL_SHIPMENT_TOKEN_SECRET;
  if (!secret) {
    throw new Error("Falta MANUAL_SHIPMENT_TOKEN_SECRET en las variables de entorno.");
  }
  return secret;
}

export function generateManualShipmentToken(reference) {
  return createHmac("sha256", getSecret()).update(reference).digest("base64url");
}

// Comparación en tiempo constante — mismo motivo que reviewToken.js.
export function isValidManualShipmentToken(reference, token) {
  if (!reference || !token) return false;

  let expected;
  try {
    expected = generateManualShipmentToken(reference);
  } catch (err) {
    console.error("[manualShipmentToken] No se pudo generar el token esperado:", err);
    return false;
  }

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(token);

  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
