import { checkAddressCompleteness } from "../../lib/aiAddressCheck";
import { checkRateLimit, rateLimitResponse } from "../../lib/rateLimit";

// Cada llamada cuesta tokens de Anthropic y el endpoint es público: se
// limita por IP (el checkout solo lo llama al salir de los campos de
// dirección, deduplicado por firma — 20/min sobra para un cliente real) y
// se recortan los campos para acotar el tamaño del prompt. Si responde
// 429, el checkout simplemente no muestra aviso (nunca bloquea el pago).
const ADDRESS_FIELDS = [
  "street",
  "housingType",
  "buildingName",
  "tower",
  "apartmentNumber",
  "additionalInstructions",
  "neighborhood",
  "city",
  "department",
];
const MAX_FIELD_LENGTH = 300;

export async function POST(request) {
  const { limited, retryAfter } = await checkRateLimit(request, "ai-address-check", {
    limit: 20,
    windowSeconds: 60,
  });
  if (limited) return rateLimitResponse(retryAfter);

  const body = await request.json().catch(() => ({}));

  const address = {};
  for (const field of ADDRESS_FIELDS) {
    const value = body?.[field];
    if (typeof value === "string") address[field] = value.slice(0, MAX_FIELD_LENGTH);
  }

  const warning = await checkAddressCompleteness(address);
  return Response.json({ warning });
}
