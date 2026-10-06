import crypto from "crypto";

// Protección de todo /admin (una sola contraseña compartida,
// ADMIN_PASSWORD en .env.local, sin usuarios ni base de datos) —
// gatillada una sola vez en app/admin/layout.js, así que /admin/finanzas,
// /admin/crm y /admin/referidos comparten la misma sesión sin pedir login
// por separado. La cookie de sesión NUNCA guarda la contraseña en texto
// plano — guarda un hash derivado de ella, calculado igual en login
// (route.js) y en cada carga del layout para comparar. Si ADMIN_PASSWORD
// cambia, cualquier cookie vieja deja de ser válida automáticamente.
export const ADMIN_COOKIE_NAME = "admin_session";

export function isValidAdminPassword(password) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof password !== "string") return false;
  // Comparación en tiempo constante (evita filtrar la clave por timing);
  // se comparan hashes para que ambos buffers midan lo mismo.
  const a = crypto.createHash("sha256").update(password).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function getAdminSessionToken() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return crypto.createHash("sha256").update(password).digest("hex");
}
