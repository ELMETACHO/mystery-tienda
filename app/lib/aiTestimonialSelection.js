// Selecciona las reseñas reales más representativas para mostrar como
// testimonios en el Home, usando Claude Haiku 4.5 (texto — no visión, más
// barato todavía que app/lib/aiProductText.js/aiPhotoDiagnosis.js).
// Nunca inventa contenido: solo elige cuáles mostrar y, si hace falta,
// corrige errores de tipeo evidentes sin cambiar el sentido.
//
// Nunca lanza: si falla, devuelve null y quien llama (el cron) debe
// conservar la selección guardada anteriormente en vez de sobrescribirla
// con algo vacío.

import { getAnthropicHeaders } from "./anthropicHeaders";

const MODEL = "claude-haiku-4-5-20251001";

function buildPrompt(reviews) {
  const list = reviews
    .map((r, i) => `[${i}] ${r.rating}★: "${r.comment}"`)
    .join("\n");

  return `Estas son reseñas reales de clientes de Mystery Cuadros, una tienda colombiana de cuadros personalizados. Elige entre 4 y 6 para mostrar como testimonios en la página principal — prioriza las más específicas, genuinas y bien escritas (evita las genéricas tipo "todo bien" si hay opciones mejores).

Reglas estrictas:
- NUNCA inventes contenido nuevo ni cambies el sentido de lo que escribió el cliente.
- Solo puedes corregir errores de tipeo/ortografía evidentes si hace falta. Si el texto ya está bien, déjalo exactamente igual.
- No agregues emojis ni frases publicitarias que el cliente no escribió.

Reseñas:
${list}

Devuelve SOLO un JSON válido: un array de 4 a 6 objetos, ordenado del más representativo al menos, con este formato exacto:
[{"index": 0, "textoPulido": "..."}]`;
}

export async function selectTestimonials(reviews) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !reviews?.length) return null;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: getAnthropicHeaders(apiKey),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        messages: [{ role: "user", content: buildPrompt(reviews) }],
      }),
    });

    if (!response.ok) {
      console.error(
        "[aiTestimonialSelection] Anthropic respondió",
        response.status,
        await response.text()
      );
      return null;
    }

    const data = await response.json();
    const text = data?.content?.find((block) => block.type === "text")?.text;
    if (!text) return null;

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const selections = parsed
      .filter(
        (item) =>
          Number.isInteger(item?.index) &&
          reviews[item.index] &&
          typeof item.textoPulido === "string" &&
          item.textoPulido.trim()
      )
      .map((item) => ({ review: reviews[item.index], textoPulido: item.textoPulido.trim() }));

    return selections.length ? selections : null;
  } catch (err) {
    console.error("[aiTestimonialSelection] No se pudo seleccionar testimonios:", err);
    return null;
  }
}
