import { validateDiscountCode } from "../../lib/discount";
import { hasPreviousOrders } from "../../lib/loyalty";

// Mismo mensaje genérico para "no existe", "ya usado" y "correo sin
// compras previas" — no darle a quien prueba códigos al azar ninguna
// pista de cuál de los tres casos fue.
const INVALID_MESSAGE = "Código inválido o ya utilizado";

export async function POST(request) {
  const { email, code } = await request.json().catch(() => ({}));

  if (!email || !code) {
    return Response.json({ valid: false, error: INVALID_MESSAGE }, { status: 400 });
  }

  const normalizedCode = String(code).trim().toUpperCase();

  // El código nunca es canjeable por un correo sin compras registradas —
  // así se cumple "no es compartible": aunque alguien conociera el
  // código de otra persona, no podría usarlo con su propio correo si
  // ese correo nunca compró.
  const eligible = await hasPreviousOrders(email);
  if (!eligible) {
    return Response.json({ valid: false, error: INVALID_MESSAGE });
  }

  const result = await validateDiscountCode({ email, code: normalizedCode });
  if (!result.valid) {
    return Response.json({ valid: false, error: INVALID_MESSAGE });
  }

  return Response.json({ valid: true, percent: result.percent });
}
