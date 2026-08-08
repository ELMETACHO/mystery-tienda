import { NextResponse } from "next/server";
import {
  ESTUDIO_COOKIE_NAME,
  getEstudioSessionToken,
  isValidEstudioPassword,
} from "../../lib/estudioAuth";

export async function POST(request) {
  const { password } = await request.json().catch(() => ({}));

  if (!process.env.ESTUDIO_PASSWORD) {
    return NextResponse.json(
      { error: "ESTUDIO_PASSWORD no está configurada en el servidor." },
      { status: 500 }
    );
  }

  if (!isValidEstudioPassword(password)) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ESTUDIO_COOKIE_NAME, getEstudioSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // path "/" (no "/estudio"): el navegador debe mandar esta cookie
    // también a /api/estudio-upload-drive y cualquier otro endpoint
    // relacionado, que viven fuera de /estudio.
    path: "/",
    // 30 días — no queremos pedir la contraseña en cada visita del mismo
    // navegador, pero tampoco dejar la sesión abierta para siempre.
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
