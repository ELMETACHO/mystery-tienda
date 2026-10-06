import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../../../lib/adminAuth";
import { getApprovedReviews, getReviewPhoto } from "../../../lib/reviews";
import { isValidReviewId } from "../../../lib/reviewModeration";

async function isAdmin() {
  const cookieStore = await cookies();
  const expected = getAdminSessionToken();
  return Boolean(expected) && cookieStore.get(ADMIN_COOKIE_NAME)?.value === expected;
}

// Foto de una reseña. En público SOLO si la reseña está aprobada y el
// cliente autorizó publicarla; pendientes/rechazadas solo las ve el admin
// (misma sesión de /admin) para moderarlas. 404 genérico en cualquier
// otro caso (no revela si el id existe).
export async function GET(request, { params }) {
  const { id } = await params;
  if (!isValidReviewId(id)) return new Response("No encontrado", { status: 404 });

  const approved = await getApprovedReviews();
  const isPublic = approved.some((r) => r.id === id && r.hasPhoto);
  const admin = !isPublic && (await isAdmin());
  if (!isPublic && !admin) return new Response("No encontrado", { status: 404 });

  const photo = await getReviewPhoto(id);
  if (!photo) return new Response("No encontrado", { status: 404 });

  return new Response(photo, {
    headers: {
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": isPublic ? "public, max-age=3600, s-maxage=3600" : "private, no-store",
    },
  });
}
