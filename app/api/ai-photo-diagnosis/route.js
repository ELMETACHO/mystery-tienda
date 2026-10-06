import { generatePhotoDiagnosis } from "../../lib/aiPhotoDiagnosis";
import { checkRateLimit, rateLimitResponse } from "../../lib/rateLimit";

// Endpoint público que llama a Claude con visión (lo más caro del sitio):
// límite por IP y validación de la imagen antes de gastar la llamada. /crear
// manda una miniatura reducida; si esto responde 429 o null, el pedido
// sigue igual (aiPhotoDiagnosis queda en null, ver CrearFlow.jsx).
const MAX_IMAGE_DATA_URL_LENGTH = 4 * 1024 * 1024;
const ALLOWED_IMAGE_PREFIX = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/;

export async function POST(request) {
  const { limited, retryAfter } = await checkRateLimit(request, "ai-photo-diagnosis", {
    limit: 10,
    windowSeconds: 60,
  });
  if (limited) return rateLimitResponse(retryAfter);

  const { imageDataUrl, sizeLabel, isLowResolution } = await request.json().catch(() => ({}));

  if (
    typeof imageDataUrl !== "string" ||
    typeof sizeLabel !== "string" ||
    !sizeLabel ||
    imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH ||
    !ALLOWED_IMAGE_PREFIX.test(imageDataUrl)
  ) {
    return Response.json({ diagnosis: null });
  }

  const diagnosis = await generatePhotoDiagnosis({
    imageDataUrl,
    sizeLabel: sizeLabel.slice(0, 80),
    isLowResolution: Boolean(isLowResolution),
  });
  return Response.json({ diagnosis });
}
