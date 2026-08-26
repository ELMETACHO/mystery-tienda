import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../../lib/adminAuth";
import { getManufacturerPendingOrders, FABRICANTE_IDS } from "../../lib/manufacturerFinance";

async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const expectedToken = getAdminSessionToken();
  return Boolean(expectedToken) && sessionCookie === expectedToken;
}

// Devuelve el saldo/pedidos de AMBOS fabricantes por separado
// (fabricantes: { daniela: {...}, oscar: {...} }) — /admin/finanzas
// muestra un bloque independiente por cada uno (ver FinanzasApp.jsx).
export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const entries = await Promise.all(
    FABRICANTE_IDS.map(async (id) => [id, await getManufacturerPendingOrders(id)])
  );
  const fabricantes = Object.fromEntries(entries);
  return Response.json({ fabricantes });
}
