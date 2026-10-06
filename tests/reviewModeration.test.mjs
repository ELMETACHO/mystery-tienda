import test from "node:test";
import assert from "node:assert/strict";
import {
  effectiveReviewStatus,
  isPubliclyVisible,
  toPublicReview,
  summarizeRatings,
  sanitizeReviewComment,
  parsePhotoDataUrl,
  isValidReviewId,
  buildProductReviewJsonLd,
  MAX_PHOTO_DATA_URL_LENGTH,
} from "../app/lib/reviewModeration.js";

const base = {
  id: "0123456789abcdef",
  status: "pending",
  consent: true,
  reference: "mystery-123",
  productId: "p1",
  rating: 5,
  comment: "Hermoso",
  displayName: "Ana P.",
  hasPhoto: true,
  submittedAt: "2026-10-05T12:00:00.000Z",
};

test("reseña nueva queda pendiente y NO es pública", () => {
  assert.equal(effectiveReviewStatus(base, {}), "pending");
  assert.equal(isPubliclyVisible(base, {}), false);
});

test("aprobada + consentimiento = pública", () => {
  const mod = { [base.id]: { status: "approved" } };
  assert.equal(effectiveReviewStatus(base, mod), "approved");
  assert.equal(isPubliclyVisible(base, mod), true);
});

test("aprobada SIN consentimiento nunca es pública", () => {
  const mod = { [base.id]: { status: "approved" } };
  assert.equal(isPubliclyVisible({ ...base, consent: false }, mod), false);
});

test("rechazada no es pública; reseñas antiguas son legacy y no públicas", () => {
  assert.equal(isPubliclyVisible(base, { [base.id]: { status: "rejected" } }), false);
  const legacy = { reference: "r", rating: 5, comment: "x" };
  assert.equal(effectiveReviewStatus(legacy, {}), "legacy");
  assert.equal(isPubliclyVisible(legacy, {}), false);
});

test("moderación con estado desconocido se ignora", () => {
  assert.equal(effectiveReviewStatus(base, { [base.id]: { status: "hack" } }), "pending");
});

test("toPublicReview no expone la referencia del pedido", () => {
  const pub = toPublicReview(base);
  assert.equal(pub.reference, undefined);
  assert.deepEqual(Object.keys(pub).sort(), [
    "comment", "displayName", "hasPhoto", "id", "productId", "rating", "sizeLabel", "submittedAt",
  ]);
});

test("summarizeRatings: sin reseñas no hay promedio", () => {
  assert.deepEqual(summarizeRatings([]), { count: 0, average: null });
  assert.deepEqual(summarizeRatings([{ rating: 5 }, { rating: 4 }, { rating: 4 }]), { count: 3, average: 4.3 });
  assert.deepEqual(summarizeRatings([{ rating: 7 }, { rating: "5" }]), { count: 0, average: null });
});

test("sanitizeReviewComment limpia control chars, recorta y limita", () => {
  assert.equal(sanitizeReviewComment("  hola\u0000 \r\n\n\n\nmundo  "), "hola \n\nmundo");
  assert.equal(sanitizeReviewComment("a".repeat(2000)).length, 1000);
  assert.equal(sanitizeReviewComment(null), "");
  assert.equal(sanitizeReviewComment("<script>x</script>"), "<script>x</script>"); // React/escapeHtml escapan al mostrar
});

test("parsePhotoDataUrl valida formato y tamaño", () => {
  assert.deepEqual(parsePhotoDataUrl(null), { buffer: null });
  assert.ok(parsePhotoDataUrl("data:image/gif;base64,AAAA").error);
  assert.ok(parsePhotoDataUrl("data:text/html;base64,PGI+").error);
  assert.ok(parsePhotoDataUrl(`data:image/jpeg;base64,${"A".repeat(MAX_PHOTO_DATA_URL_LENGTH)}`).error);
  assert.ok(parsePhotoDataUrl("data:image/jpeg;base64,AAAA").error); // demasiado chica para ser imagen
  const ok = parsePhotoDataUrl(`data:image/jpeg;base64,${Buffer.alloc(500, 1).toString("base64")}`);
  assert.equal(ok.buffer.length, 500);
});

test("isValidReviewId solo acepta 16 hex", () => {
  assert.equal(isValidReviewId("0123456789abcdef"), true);
  assert.equal(isValidReviewId("../../etc/passwd"), false);
  assert.equal(isValidReviewId("0123456789ABCDEF"), false);
  assert.equal(isValidReviewId(undefined), false);
});

test("JSON-LD: null sin reseñas; con reseñas aggregateRating real", () => {
  assert.equal(buildProductReviewJsonLd([]), null);
  const ld = buildProductReviewJsonLd([toPublicReview(base), toPublicReview({ ...base, id: "1123456789abcdef", rating: 4, comment: "" })]);
  assert.equal(ld.aggregateRating.reviewCount, 2);
  assert.equal(ld.aggregateRating.ratingValue, 4.5);
  assert.equal(ld.review.length, 2);
  assert.equal(ld.review[0].author.name, "Ana P.");
  assert.equal(ld.review[0].datePublished, "2026-10-05");
  assert.equal(ld.review[1].reviewBody, undefined);
});
