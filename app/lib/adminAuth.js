import crypto from "crypto";

// Protección simple de /admin: mismo patrón que
// app/lib/referidosAdminAuth.js (una sola contraseña compartida,
// ADMIN_PASSWORD en .env.local, sin usuarios ni base de datos). La
// cookie de sesión NUNCA guarda la contraseña en texto plano — guarda
// un hash derivado de ella, calculado igual en login (route.js) y en
// cada carga de la página (page.js) para comparar. Si ADMIN_PASSWORD
// cambia, cualquier cookie vieja deja de ser válida automáticamente.
export const ADMIN_COOKIE_NAME = "admin_session";

export function isValidAdminPassword(password) {
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected) && typeof password === "string" && password === expected;
}

export function getAdminSessionToken() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return crypto.createHash("sha256").update(password).digest("hex");
}
