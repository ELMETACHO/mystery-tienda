import { checkRateLimit, rateLimitResponse } from "../../lib/rateLimit";
import { recordChatLeadCrmEntry } from "../../lib/manufacturerFinance";
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

  // recordChatLeadCrmEntry nunca lanza (ver app/lib/manufacturerFinance.js)
  // — un fallo de Redis ahí solo se loguea, no debe impedir que el
  // visitante vea su mensaje como enviado ni que se intente el correo de
  // aviso de todas formas.
  await recordChatLeadCrmEntry({
    nombre: trimmedNombre,
    ciudad: trimmedCiudad,
    whatsapp: trimmedWhatsapp,
    pregunta: trimmedPregunta,
  });

  // El correo de aviso es un "extra" — si Resend falla, el lead ya quedó
  // guardado en el CRM, no hay que fingir que todo el request falló.
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
