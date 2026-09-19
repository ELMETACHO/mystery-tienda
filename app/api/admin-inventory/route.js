import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../../lib/adminAuth";
import { getInventory, getInventoryLog, updateInventory } from "../../lib/inventory";

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
  return Response.json({ items: await getInventory(), log: await getInventoryLog() });
}

export async function POST(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const { field, set, add, threshold } = await request.json().catch(() => ({}));
  const ok = await updateInventory({
    field,
    set: set == null ? undefined : Number(set),
    add: add == null ? undefined : Number(add),
    threshold: threshold == null ? undefined : Number(threshold),
    by: "Oscar (admin)",
  });
  if (!ok) return Response.json({ error: "No se pudo actualizar" }, { status: 400 });
  return Response.json({ ok: true, items: await getInventory(), log: await getInventoryLog() });
}
