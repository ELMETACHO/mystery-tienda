import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../../lib/adminAuth";
import { computeFinanceReport, PERIODS } from "../../lib/financeReport";

async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const expectedToken = getAdminSessionToken();
  return Boolean(expectedToken) && sessionCookie === expectedToken;
}

// Reporte financiero de /admin/reporte — todo se recalcula al vuelo acá,
// nada queda pre-agregado en Redis (ver app/lib/financeReport.js).
export async function GET(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "1m";
  if (!PERIODS.includes(period)) {
    return Response.json({ error: "Período inválido" }, { status: 400 });
  }

  const report = await computeFinanceReport(period);
  return Response.json(report);
}
