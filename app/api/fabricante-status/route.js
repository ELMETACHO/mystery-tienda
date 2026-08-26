import { getManufacturerPendingOrders } from "../../lib/manufacturerFinance";
import { getFabricanteByAccessCode } from "../../lib/fabricantes";

// Sin contraseña de admin a propósito (ver /referidos/panel): un código
// simple compartido una sola vez con cada fabricante
// (FABRICANTE_ACCESS_CODE_PREMIUM / FABRICANTE_ACCESS_CODE_TRADICIONAL en
// .env.local), solo lectura — sin CRM ni botón de marcar como pagado. El
// código recibido identifica a QUÉ fabricante pertenece (ver
// getFabricanteByAccessCode) — cada uno solo ve sus propios pedidos.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const fabricante = getFabricanteByAccessCode(code);
  if (!fabricante) {
    return Response.json({ error: "Código incorrecto" }, { status: 401 });
  }

  const { balance, orders, lastPayment } = await getManufacturerPendingOrders(fabricante.id);
  return Response.json({ balance, orders, lastPayment, fabricanteId: fabricante.id });
}
