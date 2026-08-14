import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../lib/adminAuth";
import AdminLogin from "./AdminLogin";
import AdminApp from "./AdminApp";

// Herramienta interna, sin enlace en ningún menú — mismo tratamiento
// que /estudio y /referidos/admin (desautorizada para buscadores).
export const metadata = {
  title: "Admin — Mystery",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const expectedToken = getAdminSessionToken();
  const isAuthenticated = Boolean(expectedToken) && sessionCookie === expectedToken;

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  return <AdminApp />;
}
