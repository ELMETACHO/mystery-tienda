import { cookies } from "next/headers";
import {
  REFERIDOS_ADMIN_COOKIE_NAME,
  getReferidosAdminSessionToken,
} from "../../lib/referidosAdminAuth";
import { resetReferralCommission } from "../../lib/referrals";

async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(REFERIDOS_ADMIN_COOKIE_NAME)?.value;
  const expectedToken = getReferidosAdminSessionToken();
  return Boolean(expectedToken) && sessionCookie === expectedToken;
}

// Reinicia totalCommission a 0 para el código dado — nunca toca
// totalSales ni el historial de orders (ver resetReferralCommission).
export async function POST(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { code } = await request.json().catch(() => ({}));
  if (!code) {
    return Response.json({ error: "Falta el código" }, { status: 400 });
  }

  const ok = await resetReferralCommission(code);
  if (!ok) {
    return Response.json({ error: "No se pudo marcar como pagado" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
