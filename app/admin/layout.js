import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../lib/adminAuth";
import AdminLogin from "./AdminLogin";

// Punto único de autenticación para TODO /admin (hub + /admin/finanzas +
// /admin/crm + /admin/referidos) — un layout de Next.js envuelve a todas
// sus rutas hijas, así que la sesión se valida una sola vez acá en vez
// de repetir el mismo chequeo en cada page.js. Herramienta interna, sin
// enlace en ningún menú — mismo tratamiento que /estudio (desautorizada
// para buscadores).
export const metadata = {
  title: "Admin — Mystery",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const expectedToken = getAdminSessionToken();
  const isAuthenticated = Boolean(expectedToken) && sessionCookie === expectedToken;

  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[#8fcaf0] text-[#1b2a4a]">
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/walls/fondo-cielo-2.webp)" }}
      />
      <div className="relative z-10 flex flex-1 flex-col">
        {isAuthenticated ? children : <AdminLogin />}
      </div>
    </div>
  );
}
