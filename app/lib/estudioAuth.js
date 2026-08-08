import crypto from "crypto";

// Protección simple de /estudio: sin usuarios ni base de datos, solo una
// contraseña compartida (ESTUDIO_PASSWORD en .env.local). La cookie de
// sesión NUNCA guarda la contraseña en texto plano — guarda un hash
// derivado de ella, calculado igual en login (route.js) y en cada carga
// de la página (page.js) para comparar. Si ESTUDIO_PASSWORD cambia,
// cualquier cookie vieja deja de ser válida automáticamente.
export const ESTUDIO_COOKIE_NAME = "estudio_session";

export function isValidEstudioPassword(password) {
  const expected = process.env.ESTUDIO_PASSWORD;
  return Boolean(expected) && typeof password === "string" && password === expected;
}

export function getEstudioSessionToken() {
  const password = process.env.ESTUDIO_PASSWORD;
  if (!password) return null;
  return crypto.createHash("sha256").update(password).digest("hex");
}
