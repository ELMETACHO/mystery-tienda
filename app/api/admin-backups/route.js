import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../../lib/adminAuth";
import { listPaidBackups } from "../../lib/paidBackup";

export async function GET() {
  const cookieStore = await cookies();
  const expected = getAdminSessionToken();
  if (!expected || cookieStore.get(ADMIN_COOKIE_NAME)?.value !== expected) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  return Response.json({ backups: await listPaidBackups() });
}
