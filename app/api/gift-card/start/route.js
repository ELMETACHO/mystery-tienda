import { createHash } from "crypto";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rateLimit";
import {
  GIFT_FEATURES_ENABLED,
  giftCardPriceCOP,
  isValidEmail,
  normalizeGiftMessage,
  normalizePersonName,
} from "../../../lib/giftFeatures";
import { newGiftCardReference, saveGiftCardPurchase } from "../../../lib/giftCards";
import { SITE_URL } from "../../../lib/siteUrl";

// Inicia la compra de una tarjeta regalo: el MONTO lo decide el servidor
// (precio vigente de un 40x50 Premium), nunca el navegador, y se firma
// con WOMPI_INTEGRITY_SECRET igual que /api/wompi-signature. 404 con la
// función apagada.
export async function POST(request) {
  if (!GIFT_FEATURES_ENABLED) return new Response("No encontrado", { status: 404 });

  const { limited, retryAfter } = await checkRateLimit(request, "gift-card-start", { limit: 10, windowSeconds: 600 });
  if (limited) return rateLimitResponse(retryAfter);

  const body = await request.json().catch(() => ({}));
  const buyerName = normalizePersonName(body.buyerName);
  const buyerEmail = typeof body.buyerEmail === "string" ? body.buyerEmail.trim().toLowerCase() : "";
  const recipientName = normalizePersonName(body.recipientName);
  const message = normalizeGiftMessage(body.message);

  if (!buyerName || !isValidEmail(buyerEmail)) {
    return Response.json({ error: "Revisa tu nombre y tu correo." }, { status: 400 });
  }

  const secret = process.env.WOMPI_INTEGRITY_SECRET;
  const publicKey = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY;
  if (!secret || !publicKey) {
    return Response.json({ error: "Pagos no configurados." }, { status: 500 });
  }

  const reference = newGiftCardReference();
  const amountInCents = giftCardPriceCOP() * 100;
  const currency = "COP";

  try {
    await saveGiftCardPurchase({
      reference,
      amountInCents,
      buyerName,
      buyerEmail,
      recipientName,
      message,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[gift-card/start] No se pudo guardar la compra:", err);
    return Response.json({ error: "No se pudo iniciar la compra. Intenta de nuevo." }, { status: 500 });
  }

  const signature = createHash("sha256").update(`${reference}${amountInCents}${currency}${secret}`).digest("hex");

  return Response.json(
    {
      reference,
      amountInCents,
      currency,
      signature,
      publicKey,
      redirectUrl: `${SITE_URL}/tarjeta-regalo/gracias`,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
