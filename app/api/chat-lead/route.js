import { checkRateLimit, rateLimitResponse } from "../../lib/rateLimit";
import { saveChatLead } from "../../lib/chatLeads";
import { sendChatLeadEmail } from "../../lib/email";

// Guarda un lead capturado dentro del chat (nombre + WhatsApp, ciudad y
// pregunta opcionales) — ver app/components/ChatWidget.jsx. Nunca se pide
// esto antes de que el bot haya respondido al menos una vez (ver
// CLAUDE.md); este endpoint solo persiste lo que el visitante entrega
// voluntariamente en ese punto.
export async function POST(request) {
  const { limited, retryAfter } = await checkRateLimit(request, "chat-lead", {
    limit: 5,
    windowSeconds: 300,
  });
  if (limited) return rateLimitResponse(retryAfter);

  const { nombre, ciudad, whatsapp, pregunta } = await request.json().catch(() => ({}));

  const trimmedNombre = typeof nombre === "string" ? nombre.trim().slice(0, 120) : "";
  const trimmedWhatsapp = typeof whatsapp === "string" ? whatsapp.trim().slice(0, 30) : "";

  if (!trimmedNombre || !trimmedWhatsapp) {
    return Response.json({ error: "Falta nombre o WhatsApp" }, { status: 400 });
  }

  const trimmedCiudad = typeof ciudad === "string" ? ciudad.trim().slice(0, 80) : "";
  const trimmedPregunta = typeof pregunta === "string" ? pregunta.trim().slice(0, 500) : "";

  try {
    await saveChatLead({
      nombre: trimmedNombre,
      ciudad: trimmedCiudad,
      whatsapp: trimmedWhatsapp,
      pregunta: trimmedPregunta,
    });
  } catch (err) {
    console.error("[chat-lead] No se pudo guardar el lead:", err);
    return Response.json({ error: "No se pudo guardar tus datos. Intenta de nuevo." }, { status: 500 });
  }

  // El correo de aviso es un "extra" — si Resend falla, el lead ya quedó
  // guardado en Redis, no hay que fingir que todo el request falló.
  try {
    await sendChatLeadEmail({
      nombre: trimmedNombre,
      ciudad: trimmedCiudad,
      whatsapp: trimmedWhatsapp,
      pregunta: trimmedPregunta,
    });
  } catch (err) {
    console.error("[chat-lead] No se pudo enviar el correo de aviso:", err);
  }

  return Response.json({ ok: true });
}
