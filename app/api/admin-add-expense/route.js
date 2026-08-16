import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../../lib/adminAuth";
import { addExpense } from "../../lib/financeReport";

async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const expectedToken = getAdminSessionToken();
  return Boolean(expectedToken) && sessionCookie === expectedToken;
}

// Sección "Gastos manuales" de /admin/reporte — categoría fija
// (Publicidad/Insumos, ver EXPENSE_CATEGORIES), monto, fecha, y
// descripción opcional.
export async function POST(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { category, amount, date, description } = await request.json().catch(() => ({}));
  if (!category || !amount || !date) {
    return Response.json({ error: "Faltan categoría, monto o fecha" }, { status: 400 });
  }

  const expense = await addExpense({ category, amount, date, description });
  if (!expense) {
    return Response.json({ error: "No se pudo guardar el gasto" }, { status: 400 });
  }

  return Response.json({ ok: true, expense });
}
