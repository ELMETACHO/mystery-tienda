import { checkAddressCompleteness } from "../../lib/aiAddressCheck";

// Llamado desde app/checkout/page.js al perder el foco de un campo de
// dirección — necesita vivir en el servidor porque ANTHROPIC_API_KEY
// nunca puede llegar al navegador. Nunca responde con error 4xx/5xx por
// fallas del chequeo en sí (ver checkAddressCompleteness): siempre 200
// con warning null si algo falla, para que el cliente nunca vea ni
// bloquee nada por esto — el aviso es puramente informativo.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  const warning = await checkAddressCompleteness(body);
  return Response.json({ warning });
}
