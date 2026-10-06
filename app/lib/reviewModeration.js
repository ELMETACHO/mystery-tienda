// Lógica PURA (sin Redis, sin Next) de las reseñas con foto: estados de
// moderación, qué se puede mostrar en público y cómo se arma el JSON-LD.
// Separada de app/lib/reviews.js para poder probarla con `npm test` sin
// levantar Redis (ver tests/reviewModeration.test.mjs).
//
// Regla de oro (pedido del dueño + políticas de Google): en público solo
// se muestra una reseña que (1) un humano aprobó en /admin/resenas y (2)
// el cliente autorizó publicar (casilla de consentimiento en /resena).
// Nada de estrellas, promedios ni aggregateRating inventados: si no hay
// reseñas aprobadas, no se muestra nada.

export const REVIEW_STATUSES = ["pending", "approved", "rejected"];

// Reseñas viejas (antes de este cambio) no tienen `id` ni `status`: se
// marcan "legacy" — nunca se muestran en las secciones públicas nuevas
// (no dieron consentimiento), pero el cron de testimonios del Home las
// sigue usando como hasta ahora.
export function effectiveReviewStatus(review, moderation) {
  if (!review || typeof review !== "object") return "legacy";
  const override = review.id && moderation ? moderation[review.id] : null;
  if (override && REVIEW_STATUSES.includes(override.status)) return override.status;
  if (REVIEW_STATUSES.includes(review.status)) return review.status;
  return "legacy";
}

export function isPubliclyVisible(review, moderation) {
  return (
    Boolean(review?.id) &&
    review.consent === true &&
    effectiveReviewStatus(review, moderation) === "approved"
  );
}

// Lo único que sale del servidor hacia el navegador de un visitante:
// sin referencia del pedido, sin correo, sin celular.
export function toPublicReview(review) {
  return {
    id: review.id,
    displayName: review.displayName || "Cliente Mystery",
    rating: review.rating,
    comment: review.comment || "",
    sizeLabel: review.sizeLabel || null,
    hasPhoto: Boolean(review.hasPhoto),
    submittedAt: review.submittedAt,
    productId: review.productId || null,
  };
}

export function summarizeRatings(reviews) {
  const rated = (reviews || []).filter(
    (r) => Number.isInteger(r?.rating) && r.rating >= 1 && r.rating <= 5
  );
  if (rated.length === 0) return { count: 0, average: null };
  const sum = rated.reduce((acc, r) => acc + r.rating, 0);
  return { count: rated.length, average: Math.round((sum / rated.length) * 10) / 10 };
}

// Comentario: texto plano, sin caracteres de control, colapsando saltos
// de línea excesivos. React ya escapa al renderizar y los correos usan
// escapeHtml — esto es solo higiene de datos.
export function sanitizeReviewComment(comment, maxLength = 1000) {
  if (typeof comment !== "string") return "";
  return comment
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

// La foto llega como data URL JPEG/PNG/WebP ya reducida en el navegador
// (ReviewForm la achica a ≤1600 px). Se acepta como máximo ~3 MB de
// base64 (~2,2 MB binario) — muy por debajo del límite de 4,5 MB del
// cuerpo de una función de Vercel. Devuelve el Buffer o un error.
export const MAX_PHOTO_DATA_URL_LENGTH = 3_000_000;
const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;

export function parsePhotoDataUrl(dataUrl) {
  if (dataUrl === undefined || dataUrl === null || dataUrl === "") return { buffer: null };
  if (typeof dataUrl !== "string") return { error: "Formato de foto inválido." };
  if (dataUrl.length > MAX_PHOTO_DATA_URL_LENGTH) {
    return { error: "La foto es demasiado pesada. Intenta con otra." };
  }
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) return { error: "La foto debe ser JPG, PNG o WebP." };
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length < 100) return { error: "Formato de foto inválido." };
  return { buffer };
}

export function isValidReviewId(id) {
  return typeof id === "string" && /^[a-f0-9]{16}$/.test(id);
}

// Bloque JSON-LD (Product.aggregateRating + Product.review) SOLO con
// reseñas aprobadas y propias de ESTE producto. Con 0 reseñas devuelve
// null y la página no publica estrellas (Google lo considera spam si se
// inventan o se reutilizan reseñas de otros productos).
export function buildProductReviewJsonLd(reviews) {
  const { count, average } = summarizeRatings(reviews);
  if (count === 0) return null;
  return {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: average,
      reviewCount: count,
      bestRating: 5,
      worstRating: 1,
    },
    review: reviews.slice(0, 10).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.displayName || "Cliente Mystery" },
      datePublished: (r.submittedAt || "").slice(0, 10) || undefined,
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      ...(r.comment ? { reviewBody: r.comment } : {}),
    })),
  };
}
