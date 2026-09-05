import { validateGiftCode, GIFT_SIZE_ID } from "../../lib/giftCodes";
import { confirmFreeOrder } from "../../lib/confirmFreeOrder";
import { checkRateLimit, rateLimitResponse } from "../../lib/rateLimit";

// Confirma directamente un pedido con precio final $0 (código de
// regalo) — SIN pasar por Wompi, a diferencia de /api/confirm-order y
// /api/confirm-cod-order. El navegador nunca es la fuente de verdad de
// que el código sigue siendo válido: se revalida acá server-side antes
// de confirmar nada, igual que /api/wompi-signature revalida el precio
// para un pedido pagado (ver app/lib/giftCodes.js).
export async function POST(request) {
  const { limited, retryAfter } = await checkRateLimit(request, "confirm-free-order");
  if (limited) return rateLimitResponse(retryAfter);

  const { order, customer, reference } = await request.json().catch(() => ({}));

  if (!order || !customer || !reference) {
    return Response.json({ error: "Datos incompletos" }, { status: 400 });
  }

  if (order.priceCOP !== 0) {
    return Response.json(
      { error: "Este endpoint es solo para pedidos con precio final $0" },
      { status: 400 }
    );
  }

  if (!order.giftCode) {
    return Response.json({ error: "Falta el código de regalo" }, { status: 400 });
  }

  if (order.sizeId !== GIFT_SIZE_ID) {
    return Response.json(
      { error: `El código de regalo solo aplica al tamaño ${GIFT_SIZE_ID}` },
      { status: 400 }
    );
  }

  const revalidation = await validateGiftCode(order.giftCode);
  if (!revalidation.valid) {
    return Response.json(
      { error: "El código de regalo ya no es válido o se agotaron sus usos" },
      { status: 400 }
    );
  }

  // confirmFreeOrder es idempotente (mismo mecanismo que
  // confirmApprovedOrder — ver claimTransaction en idempotency.js): un
  // reintento del navegador con la misma reference no vuelve a mandar
  // los correos ni a consumir un segundo uso del código.
  let isReturningCustomer;
  try {
    ({ isReturningCustomer } = await confirmFreeOrder({ order, customer, reference }));
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: "El pedido no se pudo confirmar del todo — inténtalo de nuevo" },
      { status: 500 }
    );
  }

  return Response.json({
    verified: true,
    reference,
    status: "APPROVED",
    isReturningCustomer,
  });
}
