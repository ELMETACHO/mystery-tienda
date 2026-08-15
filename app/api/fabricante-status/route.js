import { getManufacturerPendingOrders } from "../../lib/manufacturerFinance";

// Sin contraseña de admin a propósito (ver /referidos/panel): un código
// simple compartido una sola vez con el fabricante (FABRICANTE_ACCESS_CODE
// en .env.local), solo lectura — sin CRM ni botón de marcar como pagado.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const expected = process.env.FABRICANTE_ACCESS_CODE;

  if (!expected) {
    return Response.json(
      { error: "FABRICANTE_ACCESS_CODE no está configurado en el servidor" },
      { status: 500 }
    );
  }

  if (!code || code !== expected) {
    return Response.json({ error: "Código incorrecto" }, { status: 401 });
  }

  const { balance, orders, lastPayment } = await getManufacturerPendingOrders();
  return Response.json({ balance, orders, lastPayment });
}
