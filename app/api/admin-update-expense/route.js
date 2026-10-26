import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../../lib/adminAuth";
import { updateExpense } from "../../lib/financeReport";

async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const expectedToken = getAdminSessionToken();
  return Boolean(expectedToken) && sessionCookie === expectedToken;
}

// Botón "Editar" de un gasto manual en /admin/reporte — reemplaza
// categoría, monto, fecha, descripción y plataforma de ese gasto (por id).
export async function POST(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id, category, amount, date, description, platform } = await request
    .json()
    .catch(() => ({}));
  if (!id || !category || !amount || !date) {
    return Response.json({ error: "Faltan id, categoría, monto o fecha" }, { status: 400 });
  }

  const expense = await updateExpense(id, { category, amount, date, description, platform });
  if (!expense) {
    return Response.json({ error: "No se pudo editar el gasto" }, { status: 400 });
  }

  return Response.json({ ok: true, expense });
}
