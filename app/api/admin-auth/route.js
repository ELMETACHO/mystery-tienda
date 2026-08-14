import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  getAdminSessionToken,
  isValidAdminPassword,
} from "../../lib/adminAuth";

export async function POST(request) {
  const { password } = await request.json().catch(() => ({}));

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD no está configurada en el servidor." },
      { status: 500 }
    );
  }

  if (!isValidAdminPassword(password)) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, getAdminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // path "/" (no "/admin"): el navegador debe mandar esta cookie
    // también a /api/admin-list y /api/admin-mark-paid, que viven fuera
    // de esa ruta.
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
