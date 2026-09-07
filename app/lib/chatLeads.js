import Redis from "ioredis";

// Leads capturados desde el chat flotante (ver app/components/ChatWidget.jsx
// y app/api/chat-lead/route.js) — nombre/ciudad/WhatsApp que el visitante
// deja voluntariamente dentro del hilo del chat (nunca antes de responder,
// ver CLAUDE.md). Mismo patrón LIST + JSON que el resto de app/lib
// (catalog.js, reviews.js). No hay panel de admin todavía para verlos —
// por ahora, la única forma de enterarse es el correo que dispara
// sendChatLeadEmail (app/lib/email.js) al guardar cada uno.

let redisClient;

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    redisClient.on("error", (err) => {
      console.error("[chatLeads] Error de conexión a Redis:", err);
    });
  }

  return redisClient;
}

const CHAT_LEADS_KEY = "chat:leads";

// SÍ lanza si Redis falla — guardar el lead es el propósito completo de
// esta función, quien llama debe saber si falló para no reportar éxito
// falso al visitante.
export async function saveChatLead({ nombre, ciudad, whatsapp, pregunta }) {
  const client = getRedisClient();
  if (!client) {
    throw new Error("REDIS_URL no está configurado; no se pudo guardar el lead.");
  }

  const lead = {
    nombre,
    ciudad: ciudad || null,
    whatsapp,
    pregunta: pregunta || null,
    createdAt: new Date().toISOString(),
  };

  await client.rpush(CHAT_LEADS_KEY, JSON.stringify(lead));
  return lead;
}
