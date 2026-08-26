import { getManufacturerPendingOrders } from "../../lib/manufacturerFinance";
import { sendFabricantePaymentRequestEmail } from "../../lib/email";
import { getFabricanteByAccessCode } from "../../lib/fabricantes";

// Botón "Cobrar saldo" de /fabricante — mismo código de acceso que
// /api/fabricante-status. Nunca manda correo si no hay saldo pendiente
// (ver balance === 0 abajo): evita avisos vacíos al admin.
//
// IMPORTANTE: sendFabricantePaymentRequestEmail SIEMPRE manda el aviso al
// correo fijo del dueño (OWNER_PAYMENT_REQUEST_EMAIL), sin importar qué
// fabricante lo solicita — esto ya se corrigió una vez antes (bug donde
// el aviso terminaba yendo al fabricante en vez de al dueño). El
// fabricanteId acá solo identifica DE QUIÉN es el saldo (para incluirlo
// en el cuerpo del correo), nunca decide el destinatario.
export async function POST(request) {
  const { code } = await request.json().catch(() => ({}));

  const fabricante = getFabricanteByAccessCode(code);
  if (!fabricante) {
    return Response.json({ error: "Código incorrecto" }, { status: 401 });
  }

  const { balance } = await getManufacturerPendingOrders(fabricante.id);
  if (balance === 0) {
    return Response.json({ error: "No tienes saldo pendiente por cobrar" }, { status: 400 });
  }

  try {
    await sendFabricantePaymentRequestEmail({ amount: balance, fabricanteId: fabricante.id });
  } catch (err) {
    console.error("[fabricante-request-payment] Falló el envío del correo:", err);
    return Response.json({ error: "No se pudo enviar la solicitud. Intenta de nuevo." }, { status: 502 });
  }

  return Response.json({ ok: true });
}
