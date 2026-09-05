import { validateDiscountCode } from "../../lib/discount";
import { hasPreviousOrders } from "../../lib/loyalty";
import { getReferral, REFERRAL_DISCOUNT_PERCENT } from "../../lib/referrals";
import { validateGiftCode } from "../../lib/giftCodes";
import { checkRateLimit, rateLimitResponse } from "../../lib/rateLimit";

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
  const { limited, retryAfter } = await checkRateLimit(request, "validate-discount");
  if (limited) return rateLimitResponse(retryAfter);

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
      return Response.json({
        valid: true,
        type: "discount",
        code: normalizedCode,
        percent: result.percent,
      });
    }
  }

  // ¿Es un código de regalo (influencers, ver app/lib/giftCodes.js)?
  // 100% de descuento, solo válido para 40x50, con un límite de usos
  // totales — requiredSizeId le avisa al checkout que rechace el código
  // si el pedido actual no es justo ese tamaño (no hay forma de
  // cambiarlo desde /checkout, así que ese chequeo es solo para mostrar
  // un mensaje claro, no una medida de seguridad — la seguridad real
  // está en que /api/confirm-free-order vuelve a revalidar todo
  // server-side antes de confirmar nada).
  const gift = await validateGiftCode(normalizedCode);
  if (gift.valid) {
    return Response.json({
      valid: true,
      type: "gift",
      code: normalizedCode,
      percent: gift.percent,
      requiredSizeId: gift.sizeId,
    });
  }

  // No fue un código de descuento ni de regalo válido — ¿es un código
  // de referido?
  // Ahora también da descuento al comprador (mismo mecanismo que
  // MYSTERY10, ver REFERRAL_DISCOUNT_PERCENT) — nunca se revela el
  // nombre del referido ni ningún otro dato interno acá, solo que el
  // código existe.
  const referral = await getReferral(normalizedCode);
  if (referral) {
    return Response.json({
      valid: true,
      type: "referral",
      code: referral.code,
      percent: REFERRAL_DISCOUNT_PERCENT,
    });
  }

  return Response.json({ valid: false, error: INVALID_MESSAGE });
}
