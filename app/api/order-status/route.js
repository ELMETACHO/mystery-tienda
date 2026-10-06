import { checkRateLimit, rateLimitResponse } from "../../lib/rateLimit";
import { lookupOrderStatus, normalizePhoneInput, normalizeReference } from "../../lib/orderStatus";

// Consulta de estado para /pedido (referencia + celular). Ver
// app/lib/orderStatus.js para las reglas de privacidad. Límite por IP
// (10 cada 10 min) + tope de intentos fallidos por referencia.
const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

const NOT_FOUND_MESSAGE =
  "No encontramos un pedido con esos datos. Revisa el número de pedido (está en tu correo de confirmación) y el celular con el que pagaste. Si pagaste hace más de 30 días o necesitas ayuda, escríbenos a contacto@elmetacho.com.";

export async function POST(request) {
  const { limited, retryAfter } = await checkRateLimit(request, "order-status", {
    limit: 10,
    windowSeconds: 600,
  });
  if (limited) return rateLimitResponse(retryAfter);

  const body = await request.json().catch(() => ({}));
  const reference = normalizeReference(body?.reference);
  const phoneInput = normalizePhoneInput(body?.phone);

  if (!reference) {
    return Response.json({ error: "Escribe el número de pedido tal como aparece en tu correo." }, { status: 400, headers: NO_STORE });
  }
  if (!phoneInput) {
    return Response.json(
      { error: "Escribe los últimos 4 dígitos de tu celular o el número completo." },
      { status: 400, headers: NO_STORE }
    );
  }

  const result = await lookupOrderStatus({ reference, phoneInput });

  if (result.locked) {
    return Response.json(
      { error: "Demasiados intentos para este pedido. Intenta de nuevo en una hora o escríbenos a contacto@elmetacho.com." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": "3600" } }
    );
  }
  if (result.notFound) {
    return Response.json({ found: false, message: NOT_FOUND_MESSAGE }, { status: 404, headers: NO_STORE });
  }
  return Response.json({ found: true, status: result.status }, { headers: NO_STORE });
}
