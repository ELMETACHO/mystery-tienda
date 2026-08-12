import { validateDiscountCode } from "../../lib/discount";
import { hasPreviousOrders } from "../../lib/loyalty";
import { getReferral } from "../../lib/referrals";

// Mismo mensaje genérico para "no existe", "ya usado", "correo sin
// compras previas" y "tampoco es un código de referido" — no darle a
// quien prueba códigos al azar ninguna pista de cuál de esos casos fue.
const INVALID_MESSAGE = "Código inválido o ya utilizado";

// Un mismo campo en el checkout sirve para dos cosas distintas: un
// código de descuento (MYSTERY10, ligado al correo del comprador) o un
// código de referido (ligado a quien lo comparte, nunca al comprador).
// Se prueba primero como descuento y, si no aplica, como referido —
// nunca los dos a la vez.
export async function POST(request) {
  const { email, code } = await request.json().catch(() => ({}));

  if (!email || !code) {
    return Response.json({ valid: false, error: INVALID_MESSAGE }, { status: 400 });
  }

  const normalizedCode = String(code).trim().toUpperCase();

  // El código de descuento nunca es canjeable por un correo sin compras
  // registradas — así se cumple "no es compartible": aunque alguien
  // conociera el código de otra persona, no podría usarlo con su propio
  // correo si ese correo nunca compró. Si no es elegible para descuento,
  // no tiene sentido ni consultar discount:<email> — se pasa directo a
  // probar como código de referido.
  const eligibleForDiscount = await hasPreviousOrders(email);
  if (eligibleForDiscount) {
    const result = await validateDiscountCode({ email, code: normalizedCode });
    if (result.valid) {
      return Response.json({ valid: true, type: "discount", percent: result.percent });
    }
  }

  // No fue un código de descuento válido — ¿es un código de referido?
  // Nunca se revela el nombre del referido ni ningún dato interno acá,
  // solo que el código existe.
  const referral = await getReferral(normalizedCode);
  if (referral) {
    return Response.json({ valid: true, type: "referral", code: referral.code });
  }

  return Response.json({ valid: false, error: INVALID_MESSAGE });
}
