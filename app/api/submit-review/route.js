import { isValidReviewToken } from "../../lib/reviewToken";
import { getCompletedOrderByReference, markReviewSubmitted } from "../../lib/completedOrders";
import { saveReview } from "../../lib/reviews";
import { checkRateLimit, rateLimitResponse } from "../../lib/rateLimit";

// El token se revalida ACÁ, independientemente de que /resena ya lo
// haya validado al renderizar — un request a esta ruta puede llegar
// sin haber pasado nunca por esa página (ej. alguien reenviando el
// mismo POST), así que nunca se confía en el estado de otra petición.
export async function POST(request) {
  const { limited, retryAfter } = await checkRateLimit(request, "submit-review");
  if (limited) return rateLimitResponse(retryAfter);

  const { ref, token, rating, comment } = await request.json().catch(() => ({}));

  if (!ref || !token) {
    return Response.json({ error: "Link inválido" }, { status: 400 });
  }

  if (!isValidReviewToken(ref, token)) {
    return Response.json({ error: "Link inválido o vencido" }, { status: 401 });
  }

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return Response.json({ error: "La calificación debe ser un número entero entre 1 y 5" }, { status: 400 });
  }

  const order = await getCompletedOrderByReference(ref);
  if (!order) {
    return Response.json({ error: "No se encontró el pedido asociado a este link" }, { status: 404 });
  }

  if (order.reviewSubmittedAt) {
    return Response.json({ error: "Ya enviaste una reseña para este pedido" }, { status: 409 });
  }

  // Límite generoso, solo para no aceptar un comentario arbitrariamente
  // largo (ej. copiar/pegar un archivo entero por error).
  const trimmedComment = typeof comment === "string" ? comment.trim().slice(0, 1000) : "";

  try {
    await saveReview({
      reference: ref,
      productId: order.productId,
      rating: ratingNum,
      comment: trimmedComment,
    });
    await markReviewSubmitted(ref);
  } catch (err) {
    console.error("[submit-review] No se pudo guardar la reseña:", err);
    return Response.json({ error: "No se pudo guardar tu reseña. Intenta de nuevo." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
