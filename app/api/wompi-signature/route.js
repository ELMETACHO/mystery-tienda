import { createHash } from "crypto";
import { SIZES, COD_DEPOSIT_COP, DEFAULT_FRAME_TYPE, getPriceCOP } from "../../lib/order";
import { validateDiscountCode } from "../../lib/discount";
import { hasPreviousOrders } from "../../lib/loyalty";
import { getReferral, REFERRAL_DISCOUNT_PERCENT } from "../../lib/referrals";

// Firma de integridad de Wompi: sha256(referencia + monto_en_centavos + moneda + secreto)
// https://docs.wompi.co/docs/colombia/widget-checkout-web/#firma-de-integridad
//
// SEGURIDAD: el monto NUNCA viene del navegador. Antes este endpoint
// firmaba a ciegas el amountInCents que mandaba el cliente — un usuario
// con las devtools abiertas podía cambiarlo antes de que saliera la
// petición y pagar cualquier monto que quisiera (la firma coincidía
// porque el servidor firmaba exactamente lo que le pedían, sin
// verificar nada). Ahora el servidor recalcula el precio real desde
// cero (tamaño + descuento válido, o el anticipo fijo para
// contraentrega) y devuelve el amountInCents correcto junto con la
// firma — app/checkout/page.js usa ESE valor devuelto para abrir el
// widget de Wompi, nunca el que calculó en el navegador. Si alguien
// intenta forzar el widget con otro monto, la firma ya no coincide y
// Wompi rechaza la transacción del lado de ellos.
async function resolveAmountInCents({
  isCod,
  sizeId,
  frameType,
  discountCode,
  referralCode,
  customerEmail,
}) {
  if (isCod) {
    // El anticipo de contraentrega es un monto fijo — nunca cambia con
    // descuentos ni con frameType (ver app/checkout/page.js, handlePayCod).
    return COD_DEPOSIT_COP * 100;
  }

  const size = SIZES.find((s) => s.id === sizeId);
  if (!size) {
    throw new Error(`Tamaño desconocido: ${sizeId}`);
  }
  // frameType puede faltar en pedidos viejos ya en vuelo antes de este
  // cambio — se asume Premium (el único tipo que existía hasta ahora).
  const resolvedFrameType = frameType || DEFAULT_FRAME_TYPE;
  const basePriceCOP = getPriceCOP(sizeId, resolvedFrameType);

  let percent = 0;

  // Mutuamente excluyentes (mismo campo del checkout, ver
  // /api/validate-discount) — se prueba primero descuento, igual que ahí.
  if (discountCode) {
    // MYSTERY10 nunca es canjeable por un correo sin compras previas
    // registradas (ver /api/validate-discount) — se revalida acá por si
    // acaso, no basta con que el cliente diga que es válido.
    const eligible = customerEmail ? await hasPreviousOrders(customerEmail) : false;
    if (eligible) {
      const result = await validateDiscountCode({ email: customerEmail, code: discountCode });
      if (result.valid) {
        percent = result.percent;
      }
    }
  } else if (referralCode) {
    const referral = await getReferral(referralCode);
    if (referral) {
      percent = REFERRAL_DISCOUNT_PERCENT;
    }
  }

  const priceCOP = percent > 0 ? Math.round(basePriceCOP * (1 - percent / 100)) : basePriceCOP;
  return priceCOP * 100;
}

export async function POST(request) {
  const {
    reference,
    currency,
    sizeId,
    frameType,
    discountCode,
    referralCode,
    customerEmail,
    isCod,
  } = await request.json().catch(() => ({}));

  if (!reference || !currency) {
    return Response.json({ error: "Faltan reference o currency" }, { status: 400 });
  }
  if (!isCod && !sizeId) {
    return Response.json({ error: "Falta sizeId" }, { status: 400 });
  }

  const secret = process.env.WOMPI_INTEGRITY_SECRET;
  if (!secret) {
    return Response.json(
      { error: "WOMPI_INTEGRITY_SECRET no está configurado" },
      { status: 500 }
    );
  }

  let amountInCents;
  try {
    amountInCents = await resolveAmountInCents({
      isCod: Boolean(isCod),
      sizeId,
      frameType: frameType || null,
      discountCode: discountCode || null,
      referralCode: referralCode || null,
      customerEmail: customerEmail || null,
    });
  } catch (err) {
    console.error("[wompi-signature] No se pudo calcular el monto:", err);
    return Response.json({ error: "No se pudo calcular el monto del pedido" }, { status: 400 });
  }

  const payload = `${reference}${amountInCents}${currency}${secret}`;
  const signature = createHash("sha256").update(payload).digest("hex");

  return Response.json({ signature, amountInCents });
}
