import { getPendingOrder } from "../../lib/pendingOrders";
import { isValidCartRecoveryToken } from "../../lib/cartRecoveryToken";

// Llamado desde checkout/page.js cuando llega con ?resume=<reference>&
// token=<token> (link del correo de recuperación de carrito) — a
// diferencia del flujo normal, que carga el pedido desde IndexedDB del
// mismo navegador, esto trae order/customer directo de Redis, así que
// funciona sin importar si el cliente abre el link en otro dispositivo
// o después de borrar datos del sitio. El token (HMAC, ver
// cartRecoveryToken.js) es lo único que evita que cualquiera adivine
// una reference ajena y vea sus datos de contacto/dirección.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference");
  const token = searchParams.get("token");

  if (!isValidCartRecoveryToken(reference, token)) {
    return Response.json({ error: "Link inválido o vencido" }, { status: 401 });
  }

  const pending = await getPendingOrder(reference);
  if (!pending) {
    // El pending-order ya expiró (TTL de 2 días) o ya se confirmó y se
    // limpió — no hay nada que retomar.
    return Response.json({ error: "Este pedido ya no está disponible" }, { status: 404 });
  }

  return Response.json({ order: pending.order, customer: pending.customer });
}
