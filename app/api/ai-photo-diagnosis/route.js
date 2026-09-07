import { generatePhotoDiagnosis } from "../../lib/aiPhotoDiagnosis";

// Llamado desde CrearFlow.jsx al confirmar el tamaño/recorte — necesita
// vivir en el servidor porque ANTHROPIC_API_KEY nunca puede llegar al
// navegador. Nunca responde con error 4xx/5xx por fallas del diagnóstico
// en sí (ver generatePhotoDiagnosis): siempre 200 con diagnosis null si
// algo falla, para que el cliente nunca vea ni bloquee nada por esto.
export async function POST(request) {
  const { imageDataUrl, sizeLabel, isLowResolution } = await request.json().catch(() => ({}));

  if (!imageDataUrl || !sizeLabel) {
    return Response.json({ diagnosis: null });
  }

  const diagnosis = await generatePhotoDiagnosis({ imageDataUrl, sizeLabel, isLowResolution });
  return Response.json({ diagnosis });
}
