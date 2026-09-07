import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "../../lib/rateLimit";
import {
  CHAT_SESSION_COOKIE_NAME,
  getOrCreateChatSessionId,
  chatSessionCookieOptions,
} from "../../lib/chatSession";
import { incrementChatMessageCount, MAX_CHAT_MESSAGES } from "../../lib/chatLimit";
import { buildChatSystemPrompt } from "../../lib/chatSystemPrompt";
import { getAnthropicHeaders } from "../../lib/anthropicHeaders";

const MODEL = "claude-haiku-4-5-20251001";
const WHATSAPP_URL = "https://wa.me/573202646716";
const LIMIT_MESSAGE = `Has llegado al límite de mensajes por hoy — escríbenos por WhatsApp si necesitas más ayuda: ${WHATSAPP_URL}`;
const FALLBACK_MESSAGE = `No pude procesar tu mensaje justo ahora. Escríbenos por WhatsApp y te ayudamos: ${WHATSAPP_URL}`;

// Máximo de turnos de historial reenviados a Claude (más el mensaje nuevo)
// — el cliente ya está limitado a MAX_CHAT_MESSAGES mensajes por sesión,
// esto es solo un tope defensivo por si llega un payload manipulado.
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 2000;

function sanitizeHistory(rawMessages) {
  if (!Array.isArray(rawMessages)) return [];
  return rawMessages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_MESSAGE_LENGTH) }));
}

export async function POST(request) {
  const { limited: ipLimited, retryAfter } = await checkRateLimit(request, "chat-message", {
    limit: 20,
    windowSeconds: 60,
  });
  if (ipLimited) return rateLimitResponse(retryAfter);

  const { sessionId, isNew } = getOrCreateChatSessionId(request);

  const { count, limited } = await incrementChatMessageCount(sessionId);

  if (limited) {
    const res = NextResponse.json({ reply: LIMIT_MESSAGE, limited: true, remaining: 0 });
    if (isNew) res.cookies.set(getCookieArgs(sessionId));
    return res;
  }

  const body = await request.json().catch(() => ({}));
  const history = sanitizeHistory(body.messages);

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "Falta el mensaje del usuario" }, { status: 400 });
  }

  let reply = FALLBACK_MESSAGE;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    // Un reintento: los errores 429/5xx de Anthropic bajo carga son
    // transitorios — sin esto, cualquier blip momentáneo se le mostraba
    // al cliente como "no pude procesar tu mensaje" en vez de la
    // respuesta real. Nunca reintenta en 4xx que no sea 429 (ej. 400 por
    // un prompt inválido no se arregla solo).
    for (let attempt = 0; attempt < 2 && reply === FALLBACK_MESSAGE; attempt++) {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: getAnthropicHeaders(apiKey),
          body: JSON.stringify({
            model: MODEL,
            max_tokens: 400,
            // cache_control: el system prompt es idéntico en cada turno de
            // una misma conversación (y entre sesiones distintas, hasta que
            // cambien precios/políticas reales) — cachearlo evita
            // reprocesar esos mismos tokens en cada mensaje, sin perder
            // nada de la sincronización en vivo con legalContent.js/SIZES.
            system: [{ type: "text", text: buildChatSystemPrompt(), cache_control: { type: "ephemeral" } }],
            messages: history,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data?.content?.find((block) => block.type === "text")?.text;
          if (text?.trim()) reply = text.trim();
        } else {
          console.error(
            `[chat-message] Anthropic respondió (intento ${attempt + 1})`,
            response.status,
            await response.text()
          );
          if (response.status !== 429 && response.status < 500) break; // 4xx no transitorio: no reintentar.
        }
      } catch (err) {
        console.error(`[chat-message] No se pudo obtener respuesta de la IA (intento ${attempt + 1}):`, err);
      }
    }
  }

  const res = NextResponse.json({
    reply,
    limited: false,
    remaining: Math.max(0, MAX_CHAT_MESSAGES - count),
  });
  if (isNew) res.cookies.set(getCookieArgs(sessionId));
  return res;
}

function getCookieArgs(sessionId) {
  return {
    name: CHAT_SESSION_COOKIE_NAME,
    value: sessionId,
    ...chatSessionCookieOptions,
  };
}
