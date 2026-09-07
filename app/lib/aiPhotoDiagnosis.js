// Diagnóstico de calidad de la foto que sube un cliente en /crear, usando
// Claude Haiku 4.5 (visión) — mismo modelo/patrón que
// app/lib/aiProductText.js. El resultado NUNCA se le muestra al cliente
// (ver CLAUDE.md): viaja invisible en el pedido y solo se le muestra al
// fabricante (correo + panel /fabricante) como aviso interno de control
// de calidad, reemplazando el aviso genérico de "requiere escalarla con
// IA" por un diagnóstico específico.
//
// Nunca lanza: si falla (sin API key, red, respuesta inesperada), devuelve
// null y el pedido sigue su curso normal — este diagnóstico es una ayuda
// para el fabricante, nunca debe poder bloquear una compra.

const MODEL = "claude-haiku-4-5-20251001";

function buildPrompt({ sizeLabel, isLowResolution }) {
  return `Estás ayudando en control de calidad de una imprenta de cuadros personalizados en vinilo sobre madera. Te muestro la foto que un cliente subió para imprimir en un cuadro de ${sizeLabel}.${
    isLowResolution
      ? " Ya se detectó por conteo de píxeles que la resolución original es menor a la mínima recomendada para este tamaño."
      : ""
  }

Evalúa SOLO estos problemas visuales, si los hay: foto borrosa/con poco enfoque, mal encuadrada (caras o sujeto principal cortados, muy pegados al borde), muy oscura o con mala iluminación, o resolución insuficiente para imprimir nítido en ${sizeLabel}.

Devuelve SOLO un JSON válido, sin texto adicional, con este formato exacto:
{"hasIssue": true/false, "diagnosis": "..."}

- "hasIssue": true solo si hay uno o más problemas notables que el fabricante debería revisar antes de imprimir.
- "diagnosis": si hasIssue es true, UNA frase corta (máximo 15 palabras) en español dirigida al equipo de producción, ej: "Foto borrosa, considera escalarla antes de imprimir" o "Rostro muy cerca del borde superior, verificar encuadre". Si hasIssue es false, usa null.`;
}

export async function generatePhotoDiagnosis({ imageDataUrl, sizeLabel, isLowResolution }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !imageDataUrl) return null;

  const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const [, mediaType, base64] = match;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: buildPrompt({ sizeLabel, isLowResolution }) },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[aiPhotoDiagnosis] Anthropic respondió", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const text = data?.content?.find((block) => block.type === "text")?.text;
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.hasIssue) return null;

    const diagnosis = typeof parsed.diagnosis === "string" ? parsed.diagnosis.trim() : "";
    return diagnosis || null;
  } catch (err) {
    console.error("[aiPhotoDiagnosis] No se pudo generar el diagnóstico:", err);
    return null;
  }
}
