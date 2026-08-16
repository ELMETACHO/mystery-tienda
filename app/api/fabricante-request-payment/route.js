import { getManufacturerPendingOrders } from "../../lib/manufacturerFinance";
import { sendFabricantePaymentRequestEmail } from "../../lib/email";

function isAuthenticated(code) {
  const expected = process.env.FABRICANTE_ACCESS_CODE;
  return Boolean(expected) && code === expected;
}

// Botón "Cobrar saldo" de /fabricante — mismo código de acceso que
// /api/fabricante-status. Nunca manda correo si no hay saldo pendiente
// (ver balance === 0 abajo): evita avisos vacíos al admin.
export async function POST(request) {
  const { code } = await request.json().catch(() => ({}));

  if (!isAuthenticated(code)) {
    return Response.json({ error: "Código incorrecto" }, { status: 401 });
  }

  const { balance } = await getManufacturerPendingOrders();
  if (balance === 0) {
    return Response.json({ error: "No tienes saldo pendiente por cobrar" }, { status: 400 });
  }

  try {
    await sendFabricantePaymentRequestEmail({ amount: balance });
  } catch (err) {
    console.error("[fabricante-request-payment] Falló el envío del correo:", err);
    return Response.json({ error: "No se pudo enviar la solicitud. Intenta de nuevo." }, { status: 502 });
  }

  return Response.json({ ok: true });
}
