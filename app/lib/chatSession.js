import { randomUUID } from "crypto";

// Cookie anónima (no es autenticación — no identifica a nadie, solo agrupa
// los mensajes de una misma visita bajo un mismo id) que sirve de llave
// para el contador de mensajes del chat en Redis (ver app/lib/chatLimit.js).
// Mismo shape (httpOnly/secure/sameSite) que los cookies de sesión reales
// del proyecto (app/lib/estudioAuth.js, app/lib/adminAuth.js), pero con
// maxAge corto: el límite de mensajes ya es de 24h, no tiene sentido que
// la cookie dure más que eso.
export const CHAT_SESSION_COOKIE_NAME = "mystery_chat_session";
const MAX_AGE_SECONDS = 60 * 60 * 24; // 24h — mismo horizonte que el límite de mensajes.

// Devuelve el id de sesión existente en la request, o genera uno nuevo si
// no hay cookie todavía. Quien llama debe aplicar `cookieOptions` (abajo)
// a la respuesta cuando `isNew` es true, para que el navegador la guarde.
export function getOrCreateChatSessionId(request) {
  const existing = request.cookies.get(CHAT_SESSION_COOKIE_NAME)?.value;
  if (existing) return { sessionId: existing, isNew: false };
  return { sessionId: randomUUID(), isNew: true };
}

export const chatSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
