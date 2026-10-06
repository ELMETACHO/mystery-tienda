import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../../lib/adminAuth";
import { getReviewsForAdmin, setReviewStatus } from "../../lib/reviews";
import { isValidReviewId } from "../../lib/reviewModeration";

// Misma sesión que el resto de /admin (ver app/admin/layout.js) — mismo
// patrón de auth que app/api/admin-gift-codes/route.js.
async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const expectedToken = getAdminSessionToken();
  return Boolean(expectedToken) && sessionCookie === expectedToken;
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const reviews = await getReviewsForAdmin();
    // Sin datos de contacto: el admin modera con la referencia, el nombre
    // corto, el texto y la foto.
    return Response.json(
      {
        reviews: reviews.map((r) => ({
          id: r.id || null,
          reference: r.reference,
          productId: r.productId || null,
          rating: r.rating,
          comment: r.comment || "",
          displayName: r.displayName || null,
          sizeLabel: r.sizeLabel || null,
          consent: r.consent === true,
          hasPhoto: Boolean(r.hasPhoto),
          status: r.status,
          submittedAt: r.submittedAt,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[admin-reviews] No se pudieron leer las reseñas:", err);
    return Response.json({ error: "No se pudieron leer las reseñas." }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id, action } = await request.json().catch(() => ({}));
  if (!isValidReviewId(id) || !["approve", "reject"].includes(action)) {
    return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  try {
    const reviews = await getReviewsForAdmin();
    const review = reviews.find((r) => r.id === id);
    if (!review) return Response.json({ error: "Reseña no encontrada" }, { status: 404 });
    // Sin consentimiento NO se puede publicar, aunque el admin quiera.
    if (action === "approve" && review.consent !== true) {
      return Response.json(
        { error: "El cliente no autorizó publicar esta reseña: solo puede quedar como privada." },
        { status: 400 }
      );
    }
    const status = action === "approve" ? "approved" : "rejected";
    await setReviewStatus(id, status);
    return Response.json({ ok: true, status });
  } catch (err) {
    console.error("[admin-reviews] No se pudo moderar:", err);
    return Response.json({ error: "No se pudo guardar el cambio." }, { status: 500 });
  }
}
