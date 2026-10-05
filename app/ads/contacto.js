// WhatsApp de atención — mismo número que ya publican la Home
// (app/page.js), el chatbot (ChatWidget) y el JSON-LD del layout. El texto
// prellenado le dice al equipo que la persona viene de la landing de
// anuncios (sirve para medir a mano cuántas consultas trae la pauta).
export const WHATSAPP_URL = `https://wa.me/573202646716?text=${encodeURIComponent(
  "Hola, vengo de la página de Mystery Cuadros y tengo una pregunta sobre los cuadros personalizados."
)}`;
