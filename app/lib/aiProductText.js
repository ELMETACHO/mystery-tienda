// Genera un título y descripción corta y única por producto, a partir de
// la imagen del mockup, usando Claude Haiku 4.5 (visión) — el modelo con
// visión más barato de Anthropic, más que suficiente para describir en una
// frase lo que aparece en un cuadro. Se usa tanto al subir un diseño nuevo
// en /estudio como en el backfill de productos ya existentes.
//
// Nunca lanza: si falla (sin API key, red, respuesta inesperada), devuelve
// null y quien llama debe seguir con el fallback de texto por categoría —
// generar este texto es una mejora de SEO, no debe poder bloquear ni un
// upload en /estudio ni el registro del producto.

import { getAnthropicHeaders } from "./anthropicHeaders";

const MODEL = "claude-haiku-4-5-20251001";

const PROMPT = `Estás ayudando a una tienda colombiana de cuadros personalizados en vinilo sobre madera. Te muestro la imagen de un diseño (puede tener un fondo de pared/sillón de referencia alrededor, ignóralo — describe solo el diseño/arte central).

Devuelve SOLO un JSON válido, sin texto adicional, con este formato exacto:
{"name": "...", "description": "..."}

- "name": título corto (máximo 6 palabras) que identifique lo que se ve (personaje, escena, artista, equipo, etc). No repitas la palabra "cuadro". Ejemplo: "Luffy y Zoro en Wano".
- "description": una sola frase (máximo 25 palabras) describiendo el diseño para un cliente que está comprando el cuadro. No inventes datos que no se vean en la imagen.`;

async function fetchImageAsBase64(imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { base64: buffer.toString("base64"), mediaType: contentType.split(";")[0] };
}

export async function generateProductText({ imageUrl }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !imageUrl) return null;

  try {
    const { base64, mediaType } = await fetchImageAsBase64(imageUrl);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: getAnthropicHeaders(apiKey),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[aiProductText] Anthropic respondió", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const text = data?.content?.find((block) => block.type === "text")?.text;
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
    if (!name || !description) return null;

    return { name, description };
  } catch (err) {
    console.error("[aiProductText] No se pudo generar texto del producto:", err);
    return null;
  }
}
