import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../../lib/adminAuth";
import { createGiftCode, getAllGiftCodes } from "../../lib/giftCodes";

// Misma sesión que el resto de /admin (ver app/admin/layout.js) — mismo
// patrón de auth copiado de app/api/referidos-admin-list/route.js.
async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const expectedToken = getAdminSessionToken();
  return Boolean(expectedToken) && sessionCookie === expectedToken;
}

// Lista TODOS los códigos de regalo (activos y agotados) — a diferencia
// de /api/referidos-admin-list (solo saldo pendiente), acá el admin
// quiere ver el historial completo para saber cuáles siguen sirviendo.
export async function GET() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const codes = await getAllGiftCodes();
  return Response.json({ codes });
}

export async function POST(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { maxUses } = await request.json().catch(() => ({}));

  try {
    const code = await createGiftCode({ maxUses: maxUses ?? 3 });
    return Response.json({ code });
  } catch (err) {
    console.error("[admin-gift-codes] No se pudo generar el código:", err);
    return Response.json(
      { error: err.message || "No se pudo generar el código de regalo." },
      { status: 500 }
    );
  }
}
