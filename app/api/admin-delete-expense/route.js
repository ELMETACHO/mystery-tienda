import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../../lib/adminAuth";
import { deleteExpense } from "../../lib/financeReport";

async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const expectedToken = getAdminSessionToken();
  return Boolean(expectedToken) && sessionCookie === expectedToken;
}

// Botón "Borrar" de un gasto manual en /admin/reporte (el panel pide
// confirmación antes de llamar acá).
export async function POST(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await request.json().catch(() => ({}));
  if (!id) {
    return Response.json({ error: "Falta el id del gasto" }, { status: 400 });
  }

  const ok = await deleteExpense(id);
  if (!ok) {
    return Response.json({ error: "No se pudo borrar el gasto" }, { status: 400 });
  }

  return Response.json({ ok: true });
}
