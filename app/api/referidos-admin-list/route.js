import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../../lib/adminAuth";
import { getAllReferrals } from "../../lib/referrals";

// Usa la misma sesión que el resto de /admin (ver app/admin/layout.js) —
// ya no tiene su propia contraseña separada.
async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const expectedToken = getAdminSessionToken();
  return Boolean(expectedToken) && sessionCookie === expectedToken;
}

// Solo referidos con saldo pendiente (totalCommission > 0) — los que ya
// se pagaron o nunca vendieron nada no tienen nada que hacer en esta
// lista.
export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const all = await getAllReferrals();
  const pending = all
    .filter((r) => (r.totalCommission || 0) > 0)
    .map((r) => ({
      code: r.code,
      name: r.name,
      totalSales: r.totalSales || 0,
      totalCommission: r.totalCommission || 0,
    }))
    .sort((a, b) => b.totalCommission - a.totalCommission);

  return Response.json({ referrals: pending });
}
