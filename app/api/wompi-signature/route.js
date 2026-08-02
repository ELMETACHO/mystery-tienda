import { createHash } from "crypto";

// Firma de integridad de Wompi: sha256(referencia + monto_en_centavos + moneda + secreto)
// https://docs.wompi.co/docs/colombia/widget-checkout-web/#firma-de-integridad
export async function POST(request) {
  const { reference, amountInCents, currency } = await request.json();

  if (!reference || !amountInCents || !currency) {
    return Response.json(
      { error: "Faltan reference, amountInCents o currency" },
      { status: 400 }
    );
  }

  const secret = process.env.WOMPI_INTEGRITY_SECRET;
  if (!secret) {
    return Response.json(
      { error: "WOMPI_INTEGRITY_SECRET no está configurado" },
      { status: 500 }
    );
  }

  const payload = `${reference}${amountInCents}${currency}${secret}`;
  const signature = createHash("sha256").update(payload).digest("hex");

  return Response.json({ signature });
}
