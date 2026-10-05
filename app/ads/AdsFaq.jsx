import { SIZES, PRICES, COD_DEPOSIT_COP, formatCOP } from "../lib/order";
import { WHATSAPP_URL } from "./contacto";

// Preguntas frecuentes de /ads: responden las objeciones típicas del
// comprador colombiano ANTES del checkout (¿paga al recibir de verdad?,
// ¿cuánto tarda?, ¿mi foto sirve?, ¿cuánto cuesta cada tamaño?).
// Todo sale de información ya publicada en el sitio (Home, /checkout,
// políticas) o confirmada por el dueño (tiempos de entrega, oct 2026) —
// nada inventado. Precios leídos de app/lib/order.js (nunca a mano), así
// esta tabla no se desactualiza si cambian.
//
// <details> nativo: sin JavaScript, funciona en el navegador interno de
// TikTok/Instagram y no suma peso a la página.
export default function AdsFaq({ avisoNavidad }) {
  const deposit = formatCOP(COD_DEPOSIT_COP);
  const items = [
    {
      q: "¿Cómo funciona “paga al recibir”?",
      a: (
        <>
          Separas tu pedido con un anticipo de {deposit} (en línea, con Wompi) y pagas el resto
          en efectivo cuando el cuadro llega a la puerta de tu casa. Sin costo adicional por pagar
          contraentrega.
        </>
      ),
    },
    {
      q: "¿Cuánto se demora en llegar?",
      a: (
        <>
          Fabricamos tu cuadro en 1 a 2 días y te llega en máximo 5 días hábiles desde que haces
          el pedido.
          {avisoNavidad && <> {avisoNavidad.fraseFaq}</>}
        </>
      ),
    },
    {
      q: "¿Cuánto cuesta? ¿El envío tiene costo?",
      a: (
        <>
          El envío es gratis y ya está incluido en el precio. Precios por tamaño:
          <span className="mt-2 block overflow-hidden rounded-lg border border-black/10">
            <span className="grid grid-cols-3 bg-black/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#5b6b8c]">
              <span>Tamaño</span>
              <span className="text-right">Tradicional</span>
              <span className="text-right">Premium</span>
            </span>
            {SIZES.map((size) => (
              <span
                key={size.id}
                className="grid grid-cols-3 border-t border-black/5 px-3 py-1.5 text-xs text-[#1b2a4a]"
              >
                <span>{size.label}</span>
                <span className="text-right">
                  {PRICES.tradicional[size.id] ? formatCOP(PRICES.tradicional[size.id]) : "—"}
                </span>
                <span className="text-right font-semibold">
                  {PRICES.premium[size.id] ? formatCOP(PRICES.premium[size.id]) : "—"}
                </span>
              </span>
            ))}
          </span>
          <span className="mt-1.5 block text-[11px] text-[#5b6b8c]">
            Premium: con marco trasero de 3 cm. Tradicional: más delgado, con soporte para colgar.
          </span>
        </>
      ),
    },
    {
      q: "¿Mi foto sirve aunque no sea de buena calidad?",
      a: (
        <>
          ¡Todas las imágenes sirven! Si tu imagen tiene poca calidad la aumentamos con
          Inteligencia Artificial sin cambiar sus detalles, y nuestro equipo la revisa antes de
          imprimir. Puedes subir PNG, JPG, HEIC (fotos de iPhone) o PDF.
        </>
      ),
    },
    {
      q: "¿Cómo puedo pagar?",
      a: (
        <>
          En línea con Wompi (tarjeta o PSE), o contraentrega: anticipo de {deposit} y el resto al
          recibir. Tus datos de pago van cifrados y nunca los almacenamos.
        </>
      ),
    },
    {
      q: "¿Y si llega dañado?",
      a: (
        <>
          Tienes garantía ante daños de fábrica o de transporte: repórtalo en los primeros días de
          recibido, con fotos, y lo solucionamos. Enviamos con Servientrega, Envía, Interrapidísimo
          y más.
        </>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-md">
      <h2 className="font-heading mb-3 text-center text-xl font-bold tracking-tight">
        Preguntas frecuentes
      </h2>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <details
            key={item.q}
            className="group rounded-xl border border-black/5 bg-[#fffaf0] px-4 py-3 shadow-[0_6px_18px_-12px_rgba(30,20,60,0.3)]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#1b2a4a] [&::-webkit-details-marker]:hidden">
              {item.q}
              <span
                aria-hidden="true"
                className="text-lg leading-none text-accent transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div className="mt-2 text-sm leading-relaxed text-[#33456b]">{item.a}</div>
          </details>
        ))}
      </div>

      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-emerald-600/30 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800 active:bg-emerald-100"
      >
        <span aria-hidden="true">💬</span> ¿Otra duda? Escríbenos por WhatsApp
      </a>
    </div>
  );
}
