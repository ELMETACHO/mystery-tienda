import { createReferral } from "../../lib/referrals";
import { checkRateLimit, rateLimitResponse } from "../../lib/rateLimit";

export async function POST(request) {
  // Cada código nuevo da 5% de descuento y queda guardado para siempre en
  // Redis: se limita por IP para que nadie pueda generar miles en loop.
  const { limited, retryAfter } = await checkRateLimit(request, "create-referral", {
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (limited) return rateLimitResponse(retryAfter);

  const { name, whatsapp } = await request.json().catch(() => ({}));

  if (!name?.trim() || !whatsapp?.trim()) {
    return Response.json({ error: "Faltan nombre o WhatsApp" }, { status: 400 });
  }

  try {
    const referral = await createReferral({
      name: name.trim(),
      whatsapp: whatsapp.trim(),
    });
    return Response.json({ code: referral.code, name: referral.name });
  } catch (err) {
    console.error("[create-referral] No se pudo generar el código:", err);
    return Response.json(
      { error: "No se pudo generar tu código. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
