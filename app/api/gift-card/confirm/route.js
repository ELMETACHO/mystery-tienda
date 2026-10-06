import { fetchWompiTransaction } from "../../../lib/wompi";
import { issueGiftCardForTransaction } from "../../../lib/giftCards";
import { isGiftCardReference } from "../../../lib/giftFeatures";
import { checkRateLimit, rateLimitResponse } from "../../../lib/rateLimit";

// Al volver de Wompi (/tarjeta-regalo/gracias?id=<transacción>): se
// consulta la transacción en Wompi con la llave privada (nunca se confía
// en lo que diga el navegador) y se emite la tarjeta. NO depende del
// feature flag: si se apaga la función con una compra ya pagada en
// vuelo, igual se debe entregar. El webhook hace lo mismo por si el
// cliente cierra la pestaña.
export async function POST(request) {
  const { limited, retryAfter } = await checkRateLimit(request, "gift-card-confirm", { limit: 20, windowSeconds: 600 });
  if (limited) return rateLimitResponse(retryAfter);

  const { transactionId } = await request.json().catch(() => ({}));
  if (typeof transactionId !== "string" || !/^[A-Za-z0-9-]{6,64}$/.test(transactionId)) {
    return Response.json({ error: "Transacción inválida" }, { status: 400 });
  }

  let transaction;
  try {
    transaction = await fetchWompiTransaction(transactionId);
  } catch (err) {
    console.error("[gift-card/confirm]", err);
    return Response.json({ error: "No se pudo verificar el pago con Wompi" }, { status: 502 });
  }

  if (!isGiftCardReference(transaction?.reference)) {
    return Response.json({ error: "Transacción inválida" }, { status: 400 });
  }
  if (transaction.status !== "APPROVED") {
    return Response.json({ status: transaction.status }, { status: 402 });
  }

  try {
    const result = await issueGiftCardForTransaction(transaction);
    if (!result.ok) return Response.json({ error: "El pago no coincide con la compra." }, { status: 409 });
    return Response.json({ ok: true, status: "APPROVED" }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[gift-card/confirm] No se pudo emitir la tarjeta:", err);
    return Response.json({ error: "Pago aprobado, pero no pudimos enviar la tarjeta. Reintentaremos." }, { status: 500 });
  }
}
