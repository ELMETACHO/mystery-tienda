import fs from "fs";
import path from "path";
import { cookies } from "next/headers";
import { ESTUDIO_COOKIE_NAME, getEstudioSessionToken } from "../lib/estudioAuth";
import EstudioLogin from "./EstudioLogin";
import EstudioApp from "./EstudioApp";

// Herramienta interna, sin enlace en ningún menú — además desautorizada
// explícitamente para buscadores (ver app/robots.js) y aquí también vía
// metadata, por si algún crawler ignora robots.txt.
export const metadata = {
  title: "Estudio — Mystery",
  robots: { index: false, follow: false },
};

function listMockups() {
  const dir = path.join(process.cwd(), "public", "images", "mockups-estudio");
  try {
    return fs
      .readdirSync(dir)
      .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
      .sort();
  } catch {
    return [];
  }
}

export default async function EstudioPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ESTUDIO_COOKIE_NAME)?.value;
  const expectedToken = getEstudioSessionToken();
  const isAuthenticated = Boolean(expectedToken) && sessionCookie === expectedToken;

  if (!isAuthenticated) {
    return <EstudioLogin />;
  }

  return <EstudioApp mockups={listMockups()} />;
}
