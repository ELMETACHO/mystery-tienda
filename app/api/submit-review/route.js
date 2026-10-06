import crypto from "crypto";
import sharp from "sharp";
import { isValidReviewToken } from "../../lib/reviewToken";
import { getCompletedOrderByReference, markReviewSubmitted } from "../../lib/completedOrders";
import { claimReviewSlot, releaseReviewSlot, saveReview } from "../../lib/reviews";
import { parsePhotoDataUrl, sanitizeReviewComment } from "../../lib/reviewModeration";
import { formatCustomerDisplayName } from "../../lib/homeTestimonials";
import { checkRateLimit, rateLimitResponse } from "../../lib/rateLimit";

// Re-codifica la foto del cliente: corrige orientación, la achica a
// ≤1200 px y la guarda como JPEG SIN metadatos (sharp no copia EXIF por
// defecto — así no se publica la ubicación GPS de la casa del cliente).
// También valida que de verdad sea una imagen (si sharp no la puede leer,
// se rechaza). limitInputPixels evita "bombas" de descompresión.
async function normalizePhoto(buffer) {
  return sharp(buffer, { limitInputPixels: 40_000_000, failOn: "error" })
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

// El token se revalida ACÁ, independientemente de que /resena ya lo
// haya validado al renderizar — un request a esta ruta puede llegar
// sin haber pasado nunca por esa página (ej. alguien reenviando el
// mismo POST), así que nunca se confía en el estado de otra petición.
export async function POST(request) {
  // Más estricto que el default (10/min): cada envío puede traer una foto
  // de hasta ~2 MB y un cliente real envía UNA reseña.
  const { limited, retryAfter } = await checkRateLimit(request, "submit-review", {
    limit: 5,
    windowSeconds: 600,
  });
  if (limited) return rateLimitResponse(retryAfter);

  const { ref, token, rating, comment, photo, consent } = await request.json().catch(() => ({}));

  if (!ref || !token || typeof ref !== "string" || typeof token !== "string") {
    return Response.json({ error: "Link inválido" }, { status: 400 });
  }

  if (!isValidReviewToken(ref, token)) {
    return Response.json({ error: "Link inválido o vencido" }, { status: 401 });
  }

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return Response.json({ error: "La calificación debe ser un número entero entre 1 y 5" }, { status: 400 });
  }

  const hasConsent = consent === true;
  // Sin autorización para publicar, la foto no se guarda (no se va a usar
  // nunca y es un dato personal): se ignora en vez de rechazar la reseña.
  const parsedPhoto = hasConsent ? parsePhotoDataUrl(photo) : { buffer: null };
  if (parsedPhoto.error) {
    return Response.json({ error: parsedPhoto.error }, { status: 400 });
  }

  const order = await getCompletedOrderByReference(ref);
  if (!order) {
    return Response.json({ error: "No se encontró el pedido asociado a este link" }, { status: 404 });
  }

  if (order.reviewSubmittedAt) {
    return Response.json({ error: "Ya enviaste una reseña para este pedido" }, { status: 409 });
  }

  let photoJpeg = null;
  if (parsedPhoto.buffer) {
    try {
      photoJpeg = await normalizePhoto(parsedPhoto.buffer);
    } catch {
      return Response.json({ error: "No pudimos leer la foto. Intenta con otra (JPG o PNG)." }, { status: 400 });
    }
  }

  const trimmedComment = sanitizeReviewComment(comment);

  let claimed = false;
  try {
    claimed = await claimReviewSlot(ref);
    if (!claimed) {
      return Response.json({ error: "Ya enviaste una reseña para este pedido" }, { status: 409 });
    }
    await saveReview({
      id: crypto.randomBytes(8).toString("hex"),
      reference: ref,
      productId: order.productId,
      rating: ratingNum,
      comment: trimmedComment,
      consent: hasConsent,
      displayName: formatCustomerDisplayName(order.customerName),
      sizeLabel: order.sizeLabel || null,
      photoJpeg,
    });
    await markReviewSubmitted(ref);
  } catch (err) {
    console.error("[submit-review] No se pudo guardar la reseña:", err);
    if (claimed) await releaseReviewSlot(ref);
    return Response.json({ error: "No se pudo guardar tu reseña. Intenta de nuevo." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
