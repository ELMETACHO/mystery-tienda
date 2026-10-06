import { savePendingOrder } from "../../lib/pendingOrders";
import { checkRateLimit, rateLimitResponse } from "../../lib/rateLimit";

// Formato exacto que genera app/checkout/page.js (handlePay / handlePayCod).
const REFERENCE_PATTERN = /^mystery-(cod-)?\d{10,16}$/;
const PAYMENT_METHODS = new Set(["wompi", "cod"]);

// Llamado desde checkout/page.js justo ANTES de abrir el widget de
// Wompi (no después del pago) — guarda order/customer en Redis por
// `reference`, para que el webhook (/api/wompi-webhook) pueda
// confirmar el pedido incluso si el cliente nunca regresa a esta
// pestaña. No devuelve datos sensibles ni requiere autenticación
// especial: solo persiste lo mismo que el cliente ya tenía en su
// propio IndexedDB.
export async function POST(request) {
  // Un cliente real guarda 1 pending-order por intento de pago. Límite
  // holgado (60/min) porque en Colombia muchos celulares salen por la misma
  // IP pública (CGNAT del operador). El checkout no espera esta respuesta
  // (fire-and-forget), así que nunca suma latencia al cliente.
  const { limited, retryAfter } = await checkRateLimit(request, "save-pending-order", {
    limit: 60,
    windowSeconds: 60,
  });
  if (limited) return rateLimitResponse(retryAfter);

  const { reference, order, customer, paymentMethod } = await request.json().catch(() => ({}));

  if (!reference || !order || !customer) {
    return Response.json({ error: "Datos incompletos" }, { status: 400 });
  }

  if (
    typeof reference !== "string" ||
    !REFERENCE_PATTERN.test(reference) ||
    typeof order !== "object" ||
    typeof customer !== "object" ||
    (paymentMethod !== undefined && !PAYMENT_METHODS.has(paymentMethod))
  ) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const saved = await savePendingOrder({ reference, order, customer, paymentMethod });
  // No es fatal si falla: el checkout debe poder seguir igual (el
  // camino normal de confirmación no depende de esto). Se informa el
  // resultado igual por si el llamador quiere loguearlo.
  return Response.json({ ok: saved });
}
