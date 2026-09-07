// Headers compartidos por las 5 llamadas a la API de Anthropic del
// proyecto (aiProductText, aiPhotoDiagnosis, aiTestimonialSelection,
// aiAddressCheck, chat-message). ANTHROPIC_API_KEY es una key a nivel de
// organización (no vinculada a un solo workspace) — Anthropic exige el
// header anthropic-workspace-id en cada request para ese tipo de key, o
// responde 400 "This API key is not scoped to a workspace..." (así
// fallaban en silencio las 5 integraciones en producción hasta que se
// diagnosticó esto, septiembre 2026). Si en algún momento se genera una
// key ya vinculada a un workspace específico, este header se vuelve
// innecesario pero no hace daño dejarlo.
export function getAnthropicHeaders(apiKey) {
  return {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID,
  };
}
