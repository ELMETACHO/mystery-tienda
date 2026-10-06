import { getReferral } from "../../lib/referrals";
import { isBlockedByFailedAttempts, registerFailedAttempt, rateLimitResponse } from "../../lib/rateLimit";

// Sin contraseña a propósito (ver /referidos/panel): el código en sí ya
// funciona como identificador único y privado — quien no lo tiene no
// puede ver nada. Nunca se devuelve el whatsapp del referido, aunque
// esté guardado en Redis: el panel no lo necesita para mostrarse.
export async function GET(request) {
  const { blocked, retryAfter } = await isBlockedByFailedAttempts(request, "referral-status", { limit: 20 });
  if (blocked) return rateLimitResponse(retryAfter);

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return Response.json({ error: "Falta el código" }, { status: 400 });
  }

  const referral = await getReferral(code);
  if (!referral) {
    await registerFailedAttempt(request, "referral-status");
    return Response.json({ error: "Código no encontrado" }, { status: 404 });
  }

  return Response.json({
    code: referral.code,
    name: referral.name,
    totalSales: referral.totalSales,
    totalCommission: referral.totalCommission,
    orders: referral.orders,
    // payouts||[] por si el registro es de antes de que existiera este
    // campo (ver createReferral en app/lib/referrals.js).
    payouts: referral.payouts || [],
  });
}
