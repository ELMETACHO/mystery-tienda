import { getReviews } from "../../../lib/reviews";
import { getCompletedOrderByReference } from "../../../lib/completedOrders";
import { selectTestimonials } from "../../../lib/aiTestimonialSelection";
import { saveHomeTestimonials, formatCustomerDisplayName } from "../../../lib/homeTestimonials";

// Disparado una vez a la semana por Vercel Cron (ver vercel.json). Mismo
// patrón de autenticación que los demás crons (send-review-emails,
// send-cart-recovery-emails): Vercel firma sus propias llamadas con
// "Authorization: Bearer <CRON_SECRET>".
function isAuthorizedCronRequest(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// Mínimo de reseñas calificadas para intentar armar una selección nueva.
// Por debajo de esto, app/page.js (el Home) cae a su fallback de
// testimonios de ejemplo/semilla — mejor eso que una sección de reseñas
// con solo 1-2 tarjetas.
const MIN_REVIEWS = 4;

export async function GET(request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const allReviews = await getReviews();

  // Solo reseñas de 4-5 estrellas con comentario real (sin texto no hay
  // nada que mostrar como testimonio).
  const qualifying = allReviews.filter(
    (r) => r.rating >= 4 && typeof r.comment === "string" && r.comment.trim().length > 0
  );

  if (qualifying.length < MIN_REVIEWS) {
    return Response.json({
      ok: true,
      skipped: true,
      reason: `Solo hay ${qualifying.length} reseñas calificadas, se necesitan al menos ${MIN_REVIEWS}. Se conserva la selección anterior.`,
    });
  }

  const selections = await selectTestimonials(qualifying);

  // La IA falló o no devolvió nada usable: NO sobrescribir la selección
  // guardada (que puede seguir siendo perfectamente válida) con un
  // resultado vacío — mejor mantener lo que ya había.
  if (!selections) {
    return Response.json({
      ok: true,
      skipped: true,
      reason: "La selección con IA falló esta corrida. Se conserva la selección anterior.",
    });
  }

  // Une cada reseña elegida con su pedido completado (mismo reference)
  // para sacar nombre del cliente, tamaño comprado, y foto (solo
  // disponible en pedidos de catálogo — ver app/lib/completedOrders.js).
  const testimonials = [];
  for (const { review, textoPulido } of selections) {
    const order = await getCompletedOrderByReference(review.reference);
    testimonials.push({
      nombre: formatCustomerDisplayName(order?.customerName),
      texto: textoPulido,
      sizeLabel: order?.sizeLabel || null,
      foto: order?.thumbnailUrl || null,
      rating: review.rating,
    });
  }

  await saveHomeTestimonials(testimonials);

  return Response.json({ ok: true, checked: allReviews.length, qualifying: qualifying.length, saved: testimonials.length });
}
