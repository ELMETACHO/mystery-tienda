import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../../lib/adminAuth";
import { setMaterialCost } from "../../lib/financeReport";

async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const expectedToken = getAdminSessionToken();
  return Boolean(expectedToken) && sessionCookie === expectedToken;
}

// "Costo de materiales por cuadro" en /admin/reporte — un monto por
// tamaño (madera + vinilo + soporte) para el margen por pedido. 0 lo borra.
export async function POST(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { sizeId, amount } = await request.json().catch(() => ({}));
  if (!sizeId || amount === undefined || amount === null) {
    return Response.json({ error: "Faltan tamaño o monto" }, { status: 400 });
  }

  const ok = await setMaterialCost(sizeId, amount);
  if (!ok) {
    return Response.json({ error: "No se pudo guardar el costo" }, { status: 400 });
  }

  return Response.json({ ok: true });
}
