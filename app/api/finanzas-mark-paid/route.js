import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../../lib/adminAuth";
import { markManufacturerBalancePaid } from "../../lib/manufacturerFinance";

async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const expectedToken = getAdminSessionToken();
  return Boolean(expectedToken) && sessionCookie === expectedToken;
}

// Resetea fabricante:balance a 0 y marca todos los pedidos pendientes
// como paid:true en Redis — nunca borra el historial.
export async function POST() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const ok = await markManufacturerBalancePaid();
  if (!ok) {
    return Response.json({ error: "No se pudo marcar como pagado" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
