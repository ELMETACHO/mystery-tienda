// Verificación blanda de dirección en /checkout, usando Claude Haiku 4.5
// en texto (más barato todavía que las llamadas con visión de
// aiProductText.js/aiPhotoDiagnosis.js). Solo detecta direcciones
// OBVIAMENTE incompletas (sin número, sin barrio, campos vacíos) para
// avisarle al cliente antes de pagar — nunca bloquea nada, el aviso es
// puramente informativo y el cliente puede ignorarlo.
//
// Nunca lanza: si falla (sin API key, red, respuesta inesperada), devuelve
// null y el checkout sigue su curso normal sin ningún aviso esa vez.

const MODEL = "claude-haiku-4-5-20251001";

function buildPrompt({
  street,
  housingType,
  buildingName,
  tower,
  apartmentNumber,
  additionalInstructions,
  neighborhood,
  city,
  department,
}) {
  const housingDetail =
    housingType === "apartamento"
      ? `- Edificio/torre: "${buildingName || "(vacío)"}"${tower ? ` torre "${tower}"` : ""}\n- Número de apartamento: "${apartmentNumber || "(vacío)"}"`
      : `- Indicaciones adicionales: "${additionalInstructions || "(ninguna)"}"`;

  return `Evalúa si esta dirección de envío en Colombia (para Servientrega/Skydropx) tiene suficiente información para que un mensajero la encuentre sin problemas. NO evalúes ortografía ni estilo — solo si falta algo OBJETIVAMENTE necesario: dirección sin número visible (ej. "Cra 5" sin nada más), sin nombre de barrio, o campos con muy poco detalle.

Dirección:
- Calle/dirección: "${street}"
- Tipo de vivienda: ${housingType === "apartamento" ? "Apartamento" : "Casa"}
${housingDetail}
- Barrio: "${neighborhood}"
- Ciudad: "${city}"
- Departamento: "${department}"

Devuelve SOLO un JSON válido, sin texto adicional: {"incomplete": true/false, "warning": "..."}

- "incomplete": true SOLO si de verdad falta algo necesario para que el envío llegue sin problemas.
- "warning": si incomplete es true, UNA frase corta (máximo 20 palabras) en español, dirigida al cliente, en tono amable y nunca alarmante, sugiriendo qué revisar (ej: "Tu dirección parece incompleta — revisa que incluya número y barrio para evitar problemas de entrega"). Si incomplete es false, usa null.`;
}

export async function checkAddressCompleteness(address) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !address?.street || !address?.neighborhood || !address?.city) return null;

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
        messages: [{ role: "user", content: buildPrompt(address) }],
      }),
    });

    if (!response.ok) {
      console.error("[aiAddressCheck] Anthropic respondió", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const text = data?.content?.find((block) => block.type === "text")?.text;
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.incomplete) return null;

    const warning = typeof parsed.warning === "string" ? parsed.warning.trim() : "";
    return warning || null;
  } catch (err) {
    console.error("[aiAddressCheck] No se pudo verificar la dirección:", err);
    return null;
  }
}
