import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../../lib/adminAuth";
import { getCrmEntries } from "../../lib/manufacturerFinance";

async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const expectedToken = getAdminSessionToken();
  return Boolean(expectedToken) && sessionCookie === expectedToken;
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const entries = await getCrmEntries();
  return Response.json({ entries });
}
