import { getManufacturerPendingOrders } from "../../lib/manufacturerFinance";
import { getFabricantesByAccessCode } from "../../lib/fabricantes";

// Sin contraseña de admin a propósito (ver /referidos/panel): un código
// simple compartido con cada fabricante (FABRICANTE_ACCESS_CODE_PREMIUM
// en .env.local — Cristhian usa el mismo para Premium y Tradicional, ver
// app/lib/fabricantes.js), solo lectura — sin CRM ni botón de marcar
// como pagado. El código recibido identifica a QUÉ fabricante(s)
// pertenece (ver getFabricantesByAccessCode) — cada uno solo ve sus
// propios pedidos, nunca los de otro fabricante.
//
// Devuelve una entrada por cada fabricante que habilite ese código (hoy:
// 1 para un código exclusivo, 2 para el código compartido de Cristhian)
// — app/fabricante/page.js las muestra como pestañas separadas, sin
// sumar los saldos entre sí.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const fabricantes = getFabricantesByAccessCode(code);
  if (fabricantes.length === 0) {
    return Response.json({ error: "Código incorrecto" }, { status: 401 });
  }

  const results = await Promise.all(
    fabricantes.map(async (fabricante) => {
      const { balance, orders, lastPayment } = await getManufacturerPendingOrders(fabricante.id);
      return { fabricanteId: fabricante.id, label: fabricante.label, balance, orders, lastPayment };
    })
  );

  return Response.json({ fabricantes: results });
}
