import { savePendingOrder } from "../../lib/pendingOrders";

// Llamado desde checkout/page.js justo ANTES de abrir el widget de
// Wompi (no después del pago) — guarda order/customer en Redis por
// `reference`, para que el webhook (/api/wompi-webhook) pueda
// confirmar el pedido incluso si el cliente nunca regresa a esta
// pestaña. No devuelve datos sensibles ni requiere autenticación
// especial: solo persiste lo mismo que el cliente ya tenía en su
// propio IndexedDB.
export async function POST(request) {
  const { reference, order, customer, paymentMethod } = await request.json().catch(() => ({}));

  if (!reference || !order || !customer) {
    return Response.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const saved = await savePendingOrder({ reference, order, customer, paymentMethod });
  // No es fatal si falla: el checkout debe poder seguir igual (el
  // camino normal de confirmación no depende de esto). Se informa el
  // resultado igual por si el llamador quiere loguearlo.
  return Response.json({ ok: saved });
}
