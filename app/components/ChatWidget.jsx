"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

// Rutas de cara al fabricante/admin/diseñador — el chat es exclusivamente
// para clientes, nunca debe aparecer ahí (ver CLAUDE.md).
const HIDDEN_PREFIXES = ["/admin", "/fabricante", "/estudio"];

const WHATSAPP_URL = "https://wa.me/573202646716";

const GREETING = {
  role: "assistant",
  content:
    "¡Hola! Soy el asistente de Mystery Cuadros 💜 Pregúntame sobre precios, tamaños, tiempos de entrega, devoluciones o cómo personalizar tu cuadro.",
};

// Ícono del botón flotante: glyph de teléfono (Heroicons, MIT), inspirado
// en la idea de "hablar con alguien" de WhatsApp pero con los colores de
// marca (nunca el logo real ni su verde — ver CLAUDE.md sobre
// diferenciarse de otras marcas del mismo dueño). Path centrado por
// diseño en su viewBox 24x24 — sin composición manual de formas, para
// evitar el problema de centrado del ícono anterior.
function ChatBubbleIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" />
    </svg>
  );
}

// Convierte rutas/links conocidos dentro del texto del bot en links
// reales cliqueables — el system prompt (app/lib/chatSystemPrompt.js) le
// pide a la IA que termine cada respuesta con un CTA usando estos mismos
// paths, así que sin esto el cliente vería texto plano inerte.
const LINK_PATTERN = /(https?:\/\/\S+|\/crear\b|\/referidos\b)/g;

function renderMessageContent(text) {
  const parts = text.split(LINK_PATTERN);
  return parts.map((part, i) => {
    if (!part) return null;
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline underline-offset-2"
        >
          {part.includes("wa.me") ? "Escríbenos por WhatsApp" : part}
        </a>
      );
    }
    if (part === "/crear" || part === "/referidos") {
      return (
        <Link key={i} href={part} className="font-semibold underline underline-offset-2">
          {part}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function ChatWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [remaining, setRemaining] = useState(null); // null = todavía no se sabe (sin mensajes enviados aún)
  const [isLimited, setIsLimited] = useState(false);

  // El capturador de lead aparece UNA vez, después de la primera
  // respuesta del bot (nunca antes de responder — ver CLAUDE.md), y
  // puede omitirse; no vuelve a aparecer esa sesión si se omite o ya se
  // envió.
  const [showLeadCard, setShowLeadCard] = useState(false);
  const [leadExpanded, setLeadExpanded] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadCity, setLeadCity] = useState("");
  const [leadWhatsapp, setLeadWhatsapp] = useState("");
  const [isSendingLead, setIsSendingLead] = useState(false);
  const [leadError, setLeadError] = useState("");

  const scrollRef = useRef(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, showLeadCard]);

  if (HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p))) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending || isLimited) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      // Espera mínima antes de mostrar la respuesta: Haiku a veces contesta
      // en <300ms, y una respuesta instantánea se siente robótica/rota más
      // que rápida (la gente no confía en un chat que "no piensa" nada) —
      // 900ms deja ver el indicador "Escribiendo..." un momento real, sin
      // llegar a sentirse lento (la investigación de UX ubica el punto
      // dulce en 800ms-1.5s). No retrasa la llamada real, solo cuánto se
      // tarda en MOSTRAR el resultado que ya llegó.
      const [res] = await Promise.all([
        fetch("/api/chat-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // El saludo inicial es solo de UI, nunca se manda como turno
            // real de conversación — el servidor arma su propio contexto
            // desde cero (ver buildChatSystemPrompt).
            messages: nextMessages.filter((m) => m !== GREETING),
          }),
        }),
        new Promise((resolve) => setTimeout(resolve, 900)),
      ]);
      const data = await res.json();

      // Un 4xx/5xx (payload raro, endpoint caído) no debe empujar
      // data.reply=undefined al hilo — eso sí rompería el render (ver
      // renderMessageContent, que asume string). Se trata igual que un
      // fallo de red: mismo mensaje de respaldo con WhatsApp.
      if (!res.ok || typeof data.reply !== "string") {
        throw new Error(data?.error || `Respuesta inesperada (${res.status})`);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      if (data.limited) setIsLimited(true);

      if (!data.limited && !leadSubmitted) setShowLeadCard(true);
    } catch (err) {
      console.error("[chat] No se pudo enviar el mensaje:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `No pude procesar tu mensaje justo ahora. Escríbenos por WhatsApp y te ayudamos: ${WHATSAPP_URL}`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    if (!leadName.trim() || !leadWhatsapp.trim() || isSendingLead) return;

    setIsSendingLead(true);
    setLeadError("");
    try {
      const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content;
      const res = await fetch("/api/chat-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: leadName.trim(),
          ciudad: leadCity.trim(),
          whatsapp: leadWhatsapp.trim(),
          pregunta: lastUserMessage || "",
        }),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      setLeadSubmitted(true);
      setShowLeadCard(false);
    } catch (err) {
      console.error("[chat] No se pudo guardar el lead:", err);
      setLeadError("No pudimos guardar tus datos. Intenta de nuevo.");
    } finally {
      setIsSendingLead(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Cerrar chat" : "Abrir chat"}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 via-accent to-purple-700 text-white shadow-lg shadow-accent/50 transition-transform hover:scale-105 sm:bottom-6 sm:right-6"
      >
        {isOpen ? (
          <span className="text-2xl leading-none">✕</span>
        ) : (
          <ChatBubbleIcon className="h-7 w-7" />
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-x-4 bottom-24 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-black/10 bg-[#8fcaf0] shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-96">
          <div className="flex items-center justify-between bg-white px-4 py-3">
            <span className="text-sm font-semibold text-[#1b2a4a]">Mystery Cuadros</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar chat"
              className="text-lg text-[#5b6b8c] hover:text-[#1b2a4a]"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
            <div className="flex flex-col gap-2.5">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-snug ${
                    m.role === "user"
                      ? "self-end bg-accent text-white"
                      : "self-start bg-white text-[#1b2a4a]"
                  }`}
                >
                  {renderMessageContent(m.content)}
                </div>
              ))}

              {isSending && (
                <div className="self-start rounded-2xl bg-white px-3.5 py-2.5 text-sm text-[#5b6b8c]">
                  Escribiendo...
                </div>
              )}

              {showLeadCard && !leadSubmitted && !leadExpanded && (
                <button
                  type="button"
                  onClick={() => setLeadExpanded(true)}
                  className="mt-1 self-start rounded-full border border-dashed border-accent/50 bg-white px-3.5 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/5"
                >
                  💜 Hablar con un asesor
                </button>
              )}

              {showLeadCard && !leadSubmitted && leadExpanded && (
                <div className="mt-1 flex flex-col gap-2 rounded-2xl border border-dashed border-accent/50 bg-white p-3.5">
                  <p className="text-xs font-medium text-[#1b2a4a]">
                    Para iniciar tu chat con un asesor, dános tus datos 💜
                  </p>
                  <form onSubmit={handleLeadSubmit} className="flex flex-col gap-2">
                    <input
                      type="text"
                      placeholder="Tu nombre"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      className="rounded-lg border border-black/10 bg-[#fffaf0] px-3 py-2 text-xs text-[#1b2a4a] outline-none placeholder:text-[#9aa5b8] focus:border-accent"
                    />
                    <input
                      type="text"
                      placeholder="Tu ciudad (opcional)"
                      value={leadCity}
                      onChange={(e) => setLeadCity(e.target.value)}
                      className="rounded-lg border border-black/10 bg-[#fffaf0] px-3 py-2 text-xs text-[#1b2a4a] outline-none placeholder:text-[#9aa5b8] focus:border-accent"
                    />
                    <input
                      type="tel"
                      placeholder="Tu WhatsApp"
                      value={leadWhatsapp}
                      onChange={(e) => setLeadWhatsapp(e.target.value)}
                      className="rounded-lg border border-black/10 bg-[#fffaf0] px-3 py-2 text-xs text-[#1b2a4a] outline-none placeholder:text-[#9aa5b8] focus:border-accent"
                    />
                    {leadError && <p className="text-xs text-red-600">{leadError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={!leadName.trim() || !leadWhatsapp.trim() || isSendingLead}
                        className="flex-1 rounded-full bg-accent px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isSendingLead ? "Enviando..." : "Enviar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeadExpanded(false)}
                        className="rounded-full border border-black/10 px-3 py-2 text-xs font-medium text-[#5b6b8c] hover:border-black/20"
                      >
                        Ahora no
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {isLimited && (
                <div className="rounded-2xl bg-white px-3.5 py-2.5 text-sm text-[#1b2a4a]">
                  Has llegado al límite de mensajes por hoy — escríbenos por WhatsApp si necesitas más ayuda:{" "}
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-accent underline underline-offset-2"
                  >
                    wa.me/573202646716
                  </a>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSend} className="flex flex-col gap-1 bg-white px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={isLimited ? "Límite de mensajes alcanzado" : "Escribe tu pregunta..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLimited || isSending}
                className="flex-1 rounded-full border border-black/10 bg-[#fffaf0] px-4 py-2.5 text-sm text-[#1b2a4a] outline-none placeholder:text-[#9aa5b8] focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLimited || isSending}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Enviar"
              >
                ➤
              </button>
            </div>
            {typeof remaining === "number" && remaining > 0 && remaining <= 2 && (
              <p className="px-1 text-[10px] text-[#5b6b8c]">
                Te quedan {remaining} mensaje{remaining === 1 ? "" : "s"} hoy
              </p>
            )}
          </form>
        </div>
      )}
    </>
  );
}
