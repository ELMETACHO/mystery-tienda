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
  if (!expected || typeof password !== "string") return false;
  // Comparación en tiempo constante (evita filtrar la clave por timing);
  // se comparan hashes para que ambos buffers midan lo mismo.
  const a = crypto.createHash("sha256").update(password).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function getEstudioSessionToken() {
  const password = process.env.ESTUDIO_PASSWORD;
  if (!password) return null;
  return crypto.createHash("sha256").update(password).digest("hex");
}
