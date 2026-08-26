import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../../lib/adminAuth";
import { markManufacturerBalancePaid, FABRICANTE_IDS } from "../../lib/manufacturerFinance";

async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const expectedToken = getAdminSessionToken();
  return Boolean(expectedToken) && sessionCookie === expectedToken;
}

// Resetea fabricante:<id>:balance a 0 y marca todos los pedidos pendientes
// de ESE fabricante como paid:true en Redis — nunca borra el historial, y
// nunca afecta al otro fabricante.
export async function POST(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { fabricanteId } = await request.json().catch(() => ({}));
  if (!FABRICANTE_IDS.includes(fabricanteId)) {
    return Response.json({ error: "fabricanteId inválido" }, { status: 400 });
  }

  const ok = await markManufacturerBalancePaid(fabricanteId);
  if (!ok) {
    return Response.json({ error: "No se pudo marcar como pagado" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
