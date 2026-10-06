import { getApprovedReviews } from "../../../lib/reviews";
import { summarizeRatings } from "../../../lib/reviewModeration";

// Reseñas APROBADAS (y con consentimiento) para la sección "Fotos de
// clientes" del Home y /ads. La pide CustomerReviews.jsx en el navegador
// solo cuando la sección está por entrar en pantalla — nunca bloquea el
// render ni el LCP. Cacheada en el CDN 5 min.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const onlyPhotos = searchParams.get("photos") === "1";
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 6, 1), 12);

  const all = await getApprovedReviews();
  const pool = onlyPhotos ? all.filter((r) => r.hasPhoto) : all;

  return Response.json(
    { reviews: pool.slice(0, limit), summary: summarizeRatings(all) },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } }
  );
}
