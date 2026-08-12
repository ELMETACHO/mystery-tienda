import { cookies } from "next/headers";
import {
  REFERIDOS_ADMIN_COOKIE_NAME,
  getReferidosAdminSessionToken,
} from "../../lib/referidosAdminAuth";
import ReferidosAdminLogin from "./ReferidosAdminLogin";
import ReferidosAdminApp from "./ReferidosAdminApp";

// Herramienta interna, sin enlace en ningún menú — mismo tratamiento
// que /estudio (desautorizada para buscadores).
export const metadata = {
  title: "Admin referidos — Mystery",
  robots: { index: false, follow: false },
};

export default async function ReferidosAdminPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(REFERIDOS_ADMIN_COOKIE_NAME)?.value;
  const expectedToken = getReferidosAdminSessionToken();
  const isAuthenticated = Boolean(expectedToken) && sessionCookie === expectedToken;

  if (!isAuthenticated) {
    return <ReferidosAdminLogin />;
  }

  return <ReferidosAdminApp />;
}
