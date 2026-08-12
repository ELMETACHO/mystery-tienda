import { NextResponse } from "next/server";
import {
  REFERIDOS_ADMIN_COOKIE_NAME,
  getReferidosAdminSessionToken,
  isValidReferidosAdminPassword,
} from "../../lib/referidosAdminAuth";

export async function POST(request) {
  const { password } = await request.json().catch(() => ({}));

  if (!process.env.REFERIDOS_ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "REFERIDOS_ADMIN_PASSWORD no está configurada en el servidor." },
      { status: 500 }
    );
  }

  if (!isValidReferidosAdminPassword(password)) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(REFERIDOS_ADMIN_COOKIE_NAME, getReferidosAdminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // path "/" (no "/referidos/admin"): el navegador debe mandar esta
    // cookie también a /api/referidos-admin-list y
    // /api/referidos-admin-mark-paid, que viven fuera de esa ruta.
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
