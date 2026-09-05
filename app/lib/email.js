import { Resend } from "resend";
import { formatCOP } from "./order";
import { generateManualShipmentToken } from "./manualShipmentToken";
import { getFabricanteForFrameType } from "./fabricantes";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Mystery <pedidos@elmetacho.com>";
// Para armar links absolutos dentro de correos (botón "Ya fabriqué el
// cuadro - generar guía" en manualShipmentUrl, y /resena en
// sendReviewRequestEmail) — SIEMPRE se manda un correo real (Resend no
// tiene "modo local"), así que el link no puede depender del origin de
// una request como en un endpoint normal; tiene que quedar fijo en el
// momento de armar el correo.
//
// Caso real que reveló el bug (agosto 2026): en localhost, sin SITE_URL
// definido en .env.local, este fallback SIEMPRE apuntaba a producción —
// un pedido de prueba hecho en localhost terminaba generando una guía
// REAL contra producción (dinero real en Skydropx) en vez de contra el
// servidor local, sin ningún indicio visible (la terminal de dev nunca
// veía la request, porque nunca llegaba ahí). Ahora el fallback depende
// de NODE_ENV en vez de estar fijo a producción — pero de todos modos
// se recomienda definir SITE_URL explícitamente en .env.local
// (http://localhost:3000) para que sea explícito y no dependa de un
// fallback implícito.
const SITE_URL =
  process.env.SITE_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://tienda.elmetacho.com");
// DEBUG TEMPORAL — quitar después de diagnosticar por qué SITE_URL
// seguía apuntando a producción en local pese a estar en .env.local.
console.log(
  `[DEBUG SITE_URL] process.env.SITE_URL=${JSON.stringify(process.env.SITE_URL)} | process.env.NODE_ENV=${JSON.stringify(process.env.NODE_ENV)} | valor final=${JSON.stringify(SITE_URL)}`
);
const ADMIN_EMAIL = "contacto@elmetacho.com";

// El correo de "nuevo pedido" ya NO va a un solo MANUFACTURER_EMAIL fijo:
// desde Premium/Tradicional (agosto 2026) va SOLO al fabricante que
// corresponde a order.frameType (ver getFabricanteForFrameType) — nunca a
// ambos, nunca al equivocado.
function adminRecipientsForFrameType(frameType) {
  const fabricante = getFabricanteForFrameType(frameType);
  return [ADMIN_EMAIL, fabricante?.email].filter(Boolean);
}

// Sin cuenta de Instagram real configurada todavía — mismo placeholder que
// se usa en el resto del sitio (Home, /checkout/confirmacion).
const INSTAGRAM_URL = "#";

// Paleta de marca para HTML de correo: los clientes de correo (sobre todo
// Outlook de escritorio) no soportan CSS moderno (custom properties, flex,
// grid), así que todo va con estilos inline y valores hex directos en vez
// de var(--accent). Un morado ligeramente más oscuro (TEXT) se usa para
// texto sobre fondo blanco por contraste; el morado de marca "puro"
// (SOLID) se usa para fondos/badges con texto claro encima.
//
// Paleta alineada al rediseño "retro cielo" del sitio (ver CLAUDE.md,
// feature/rebrand-retro-bubble) — mismo celeste sólido de fondo y azul
// marino de texto que usa el resto del sitio (Home, /crear, /fabricante),
// en vez de la paleta oscura/lila que tenían los correos antes del
// rediseño. Sin degradados ni imágenes de fondo: los clientes de correo
// (Gmail, Outlook, Apple Mail) no las renderizan de forma confiable.
const BRAND = {
  solid: "#a855f7",
  soft: "#c084fc",
  text: "#7c3aed", // más oscuro que --accent, para legibilidad sobre blanco
  sky: "#d6ecfb", // fondo celeste sólido claro, fuera de la tarjeta
  card: "#ffffff", // tarjetas blancas
  ink: "#1b2a4a",
  muted: "#33456b",
  faint: "#5b6b8c",
  border: "#e4e4e7",
  lilac: "#f5f0ff",
  success: "#166534",
  successBg: "#dcfce7",
  warning: "#92400e",
  warningBg: "#fef3c7",
};

const FONT_STACK = "Arial, Helvetica, sans-serif";

// Logo nuevo del rediseño (mismo archivo que usa la navbar del sitio,
// public/images/Logo/logo-navbar.png) — necesita una URL absoluta porque
// Resend no tiene "modo local" y los clientes de correo no resuelven
// rutas relativas del sitio.
const LOGO_URL = `${SITE_URL}/images/Logo/logo-navbar.png`;

// Encabezado compartido por TODOS los correos transaccionales: logo sobre
// tarjeta blanca, con un `subtitle` opcional (ej. "Nuevo pedido") para los
// correos operativos que antes llevaban ese texto junto al wordmark.
// Vive en un solo lugar para que el estilo de marca se actualice de forma
// consistente en todos los correos a la vez, sin tocar cada plantilla.
//
// Envuelve el HTML de cada correo en un documento completo con:
//   1. meta color-scheme/supported-color-schemes "light" + <style>
//      :root{color-scheme:light} — funciona en Apple Mail/Outlook.com,
//      pero Gmail (sobre todo la app móvil) los IGNORA por completo.
//   2. bgcolor= HTML clásico redundante junto al style= en las tablas de
//      fondo/tarjeta — sobrevive mejor que el CSS puro en clientes viejos,
//      pero Gmail también lo ignora en modo oscuro forzado.
//   3. La pieza que SÍ funciona en Gmail: reglas [data-ogsc]/[data-ogsb]
//      en el <style> de abajo. Gmail (web y algunas versiones de la app)
//      agrega esos atributos a los elementos cuando el usuario está en
//      modo oscuro, y SÍ respeta CSS que los seleccione explícitamente —
//      a diferencia del meta tag, que ignora sin más. Cada clase
//      email-* (ver BG_CLASSES/TEXT_CLASSES abajo, y las clases que trae
//      cada *EmailHtml) tiene acá su regla espejo con !important, para
//      que el color se mantenga exacto sin importar el modo del usuario.
// Confirmado con una prueba real en Gmail Android (septiembre 2026): sin
// las reglas [data-ogsc]/[data-ogsb], la tarjeta blanca y el fondo
// celeste se invertían a un panel negro con texto blanco pese a 1 y 2.
function wrapEmailHtml(bodyHtml) {
  const ogscRule = (selector, prop, value) =>
    `[data-ogsc] .${selector}, [data-ogsb] .${selector} { ${prop}: ${value} !important; }`;

  const BG_CLASSES = [
    ["email-bg", BRAND.sky],
    ["email-card", BRAND.card],
    ["email-footer-bg", "#fafafa"],
    ["email-banner-success-bg", BRAND.successBg],
    ["email-banner-warning-bg", BRAND.warningBg],
    ["email-banner-lilac-bg", BRAND.lilac],
    ["email-btn-bg", BRAND.solid],
  ];
  const TEXT_CLASSES = [
    ["email-text-ink", BRAND.ink],
    ["email-text-muted", BRAND.muted],
    ["email-text-faint", BRAND.faint],
    ["email-text-brand", BRAND.text],
    ["email-text-success", BRAND.success],
    ["email-text-warning", BRAND.warning],
    ["email-text-white", "#ffffff"],
    ["email-text-bleed-note", "#4c1d95"],
    ["email-text-subtle", "#a1a1aa"],
  ];

  const ogscCss = [
    ...BG_CLASSES.map(([cls, color]) => ogscRule(cls, "background-color", color)),
    ...TEXT_CLASSES.map(([cls, color]) => ogscRule(cls, "color", color)),
  ].join("\n      ");

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>Mystery</title>
    <style>
      :root {
        color-scheme: light;
        supported-color-schemes: light;
      }
      ${ogscCss}
    </style>
  </head>
  <body class="email-bg" bgcolor="${BRAND.sky}" style="margin:0;padding:0;background-color:${BRAND.sky};">
    ${bodyHtml}
  </body>
</html>`;
}

function emailHeaderRow(subtitle) {
  return `
    <tr>
      <td class="email-card" bgcolor="${BRAND.card}" style="background-color:${BRAND.card};padding:20px 24px;text-align:center;border-bottom:1px solid ${BRAND.border};">
        <img src="${LOGO_URL}" alt="Mystery" width="130" height="84" style="display:inline-block;height:auto;max-width:130px;" />
        ${
          subtitle
            ? `<p class="email-text-muted" style="margin:8px 0 0 0;font-family:${FONT_STACK};font-size:12px;font-weight:bold;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.5px;">${subtitle}</p>`
            : ""
        }
      </td>
    </tr>
  `;
}

// Extrae el base64 de un data URL de imagen, validando primero que
// realmente tenga esa forma ("data:image/...;base64,XXXX"). Si el valor no
// es un data URL de imagen válido (undefined, string vacío, corrupto,
// etc.), devuelve null en vez de adjuntar bytes basura sin darse cuenta —
// mejor no adjuntar nada a que llegue un PNG que no abre.
function extractImageBase64(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return null;
  }
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) return null;
  const base64 = dataUrl.slice(commaIndex + 1);
  return base64 || null;
}

// Descarga la etiqueta de envío (labelUrl de Skydropx, ver
// app/lib/skydropx.js) para adjuntarla en PDF al correo del fabricante.
// Nunca lanza: si la descarga falla (link vencido, red, etc.), el correo
// sigue su curso sin ese adjunto en vez de bloquear la confirmación del
// pedido — el aviso de guía generada en el cuerpo del correo ya avisa el
// número de guía de todos modos.
async function fetchLabelPdfBase64(labelUrl) {
  if (!labelUrl) return null;
  try {
    const res = await fetch(labelUrl);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  } catch (err) {
    console.error("[email] No se pudo descargar la etiqueta de envío para adjuntarla:", err);
    return null;
  }
}

// Los mensajes de error de Skydropx (shipmentError) se muestran tal cual
// vinieron del SDK/API en el correo al fabricante — se escapan por las
// dudas antes de insertarlos en el HTML.
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function housingDetailsRows(customer) {
  if (customer.housingType === "apartamento") {
    return `
      <p class="email-text-muted" style="margin:0;font-size:14px;line-height:21px;color:${BRAND.muted};">Edificio ${customer.buildingName || "-"}${customer.tower ? `, Torre ${customer.tower}` : ""}, Apto ${customer.apartmentNumber || "-"}</p>
    `;
  }
  if (customer.additionalInstructions) {
    return `
      <p class="email-text-muted" style="margin:0;font-size:14px;line-height:21px;color:${BRAND.muted};">${customer.additionalInstructions}</p>
    `;
  }
  return "";
}

// ---------------------------------------------------------------------
// Correo al cliente
// ---------------------------------------------------------------------

function customerEmailHtml({
  order,
  customer,
  isReturningCustomer,
  paymentMethod,
  anticipoPagado,
  saldoPendiente,
}) {
  const isCod = paymentMethod === "cod";
  const loyaltyBlock = isReturningCustomer
    ? `
      <tr>
        <td style="padding:0 32px 24px 32px;">
          <table class="email-banner-lilac-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.lilac};border:1px dashed ${BRAND.solid};border-radius:10px;">
            <tr>
              <td style="padding:18px;text-align:center;">
                <p class="email-text-brand" style="margin:0 0 4px 0;font-family:${FONT_STACK};font-size:16px;font-weight:bold;color:${BRAND.text};">¡Eres cliente fiel! 🎉</p>
                <p class="email-text-muted" style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:13px;color:${BRAND.muted};">Tienes 10% de descuento en tu próxima compra</p>
                <span class="email-card email-text-ink" style="display:inline-block;background-color:#ffffff;border:1px solid ${BRAND.solid};border-radius:6px;padding:8px 18px;font-family:'Courier New',Courier,monospace;font-size:14px;font-weight:bold;color:${BRAND.ink};letter-spacing:1px;">MYSTERY10%</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
    : "";

  return `
<table class="email-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.sky}" style="background-color:${BRAND.sky};padding:32px 12px;font-family:${FONT_STACK};">
  <tr>
    <td align="center">
      <table class="email-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.card}" style="max-width:560px;background-color:${BRAND.card};border-radius:20px;overflow:hidden;">
        ${emailHeaderRow()}

        <tr>
          <td style="padding:32px 32px 8px 32px;">
            <p class="email-text-ink" style="margin:0 0 6px 0;font-family:${FONT_STACK};font-size:20px;font-weight:bold;color:${BRAND.ink};">¡Gracias por tu pedido, ${customer.fullName}!</p>
            <p class="email-text-muted" style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:22px;color:${BRAND.muted};">${
              isCod
                ? "Confirmamos que recibimos tu anticipo — el saldo restante lo pagas en efectivo cuando recibas tu cuadro. Tu cuadro personalizado ya está en preparación."
                : "Confirmamos que tu pago fue aprobado y tu cuadro personalizado ya está en preparación."
            }</p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px 4px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.border};border-radius:10px;">
              <tr>
                <td style="padding:18px;" align="center">
                  <p class="email-text-muted" style="margin:0 0 4px 0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.muted};">${order.sizeLabel}</p>
                  <p class="email-text-brand" style="margin:0;font-family:${FONT_STACK};font-size:22px;font-weight:bold;color:${BRAND.text};">${formatCOP(order.priceCOP)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${
          isCod
            ? `
        <tr>
          <td style="padding:12px 32px 4px 32px;">
            <table class="email-banner-success-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.successBg};border-radius:8px;">
              <tr>
                <td style="padding:12px 16px;">
                  <p class="email-text-success" style="margin:0 0 4px 0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.success};">✅ Anticipo recibido: <strong>${formatCOP(anticipoPagado)}</strong></p>
                  <p class="email-text-success" style="margin:0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.success};">💵 Saldo a pagar al recibir tu cuadro: <strong>${formatCOP(saldoPendiente)}</strong></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        `
            : ""
        }

        <tr>
          <td style="padding:20px 32px 8px 32px;">
            <p class="email-text-ink" style="margin:0 0 10px 0;font-family:${FONT_STACK};font-size:12px;font-weight:bold;color:${BRAND.ink};text-transform:uppercase;letter-spacing:0.5px;">Próximos pasos</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td class="email-text-ink" style="padding:3px 0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.ink};">✅&nbsp; <strong>${isCod ? "Anticipo confirmado (pagas el saldo contraentrega)" : "Pago confirmado"}</strong></td></tr>
              <tr><td class="email-text-muted" style="padding:3px 0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.muted};">🎨&nbsp; En producción <span class="email-text-subtle" style="color:#a1a1aa;">(3-5 días hábiles)</span></td></tr>
              <tr><td class="email-text-muted" style="padding:3px 0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.muted};">🚚&nbsp; Envío a tu dirección</td></tr>
            </table>
          </td>
        </tr>

        ${loyaltyBlock}

        <tr>
          <td style="padding:8px 32px 32px 32px;">
            <p class="email-text-muted" style="margin:0;font-family:${FONT_STACK};font-size:14px;line-height:20px;color:${BRAND.muted};">Te avisaremos apenas tu cuadro esté en camino. ¡Gracias por confiar en Mystery!</p>
          </td>
        </tr>

        <tr>
          <td class="email-footer-bg" style="background-color:#fafafa;border-top:1px solid ${BRAND.border};padding:20px 32px;">
            <p class="email-text-faint" style="margin:0 0 6px 0;font-family:${FONT_STACK};font-size:12px;color:${BRAND.faint};">Mystery · ${ADMIN_EMAIL}</p>
            <p class="email-text-faint" style="margin:0 0 6px 0;font-family:${FONT_STACK};font-size:12px;color:${BRAND.faint};">Síguenos en <a class="email-text-brand" href="${INSTAGRAM_URL}" style="color:${BRAND.text};text-decoration:none;">Instagram</a></p>
            <p class="email-text-faint" style="margin:0;font-family:${FONT_STACK};font-size:12px;color:${BRAND.faint};">¿Dudas con tu pedido? Responde este correo, con gusto te ayudamos.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `;
}

// ---------------------------------------------------------------------
// Correo al admin/fabricante — operativo, legible rápido desde el celular
// ---------------------------------------------------------------------

function adminEmailHtml({
  order,
  customer,
  transaction,
  isReturningCustomer,
  paymentMethod,
  trackingNumber,
  carrierName,
  shipmentError,
  manualShipmentUrl,
  fabricanteUrl,
  anticipoPagado,
  saldoPendiente,
}) {
  const isCod = paymentMethod === "cod";
  // En la práctica esta función solo se llama después de verificar el pago
  // con Wompi (ver app/api/confirm-order/route.js) para el método normal,
  // así que isPaid siempre debería ser true ahí — igual se deja explícito y
  // visible en vez de asumido. Los pedidos contraentrega también verifican
  // el anticipo con Wompi antes de llegar acá (ver
  // app/api/confirm-cod-order/route.js) — su banner muestra el desglose
  // anticipo/saldo en vez de un simple "pagado"/"no confirmado".
  const isPaid = transaction.status === "APPROVED";

  const paymentBanner = isCod
    ? `
      <table class="email-banner-success-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.successBg};border-radius:6px;">
        <tr>
          <td style="padding:10px 14px;">
            <p class="email-text-success" style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:14px;font-weight:bold;color:${BRAND.success};">✅ Anticipo pagado: ${formatCOP(anticipoPagado)}</p>
            <p class="email-text-success" style="margin:0;font-family:${FONT_STACK};font-size:14px;font-weight:bold;color:${BRAND.success};">💵 Saldo a cobrar al entregar: ${formatCOP(saldoPendiente)}</p>
          </td>
        </tr>
      </table>
    `
    : `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${isPaid ? BRAND.successBg : BRAND.warningBg};border-radius:6px;">
        <tr>
          <td style="padding:10px 14px;">
            <p style="margin:0;font-family:${FONT_STACK};font-size:14px;font-weight:bold;color:${isPaid ? BRAND.success : BRAND.warning};">
              Estado de pago: ${isPaid ? "✅ Pagado" : `⚠️ No confirmado (${transaction.status})`}
            </p>
          </td>
        </tr>
      </table>
    `;

  // Aviso de tipo de cuadro: Tradicional NUNCA lleva marco trasero (avisar
  // explícito para que el fabricante no lo agregue por costumbre), Premium
  // SIEMPRE lo lleva (recordatorio de verificación antes de despachar).
  const isPremium = order.frameType !== "tradicional";
  const frameTypeBanner = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${isPremium ? BRAND.lilac : BRAND.warningBg};border-radius:6px;">
      <tr>
        <td style="padding:10px 14px;">
          <p style="margin:0;font-family:${FONT_STACK};font-size:13px;font-weight:bold;color:${isPremium ? BRAND.text : BRAND.warning};">
            ${
              isPremium
                ? "🖼️ Premium — este pedido SIEMPRE lleva marco trasero de 3cm. Confirmar antes de despachar."
                : "⚠️ Tradicional — este diseño NO lleva marco trasero."
            }
          </p>
        </td>
      </tr>
    </table>
  `;

  // Nota discreta de baja resolución — nunca visible para el cliente (ver
  // CLAUDE.md), solo para que el fabricante sepa que esta imagen necesita
  // pasar por escalado con IA antes de imprimir. order.needsAiUpscale se
  // marca en /crear (CrearFlow.jsx) cuando la foto original no cumple la
  // resolución mínima para el tamaño elegido.
  const aiUpscaleNote = order.needsAiUpscale
    ? `
      <tr>
        <td style="padding:0 20px 16px 20px;">
          <table class="email-banner-warning-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.warningBg};border-radius:6px;">
            <tr>
              <td style="padding:10px 14px;">
                <p class="email-text-warning" style="margin:0;font-family:${FONT_STACK};font-size:13px;font-weight:bold;color:${BRAND.warning};">
                  ⚠️ Esta imagen requiere escalarla con IA antes de imprimir
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
    : "";

  // La guía de Skydropx YA NO se genera automáticamente al pagar (ver
  // CLAUDE.md) — el fabricante la dispara cuando el cuadro esté listo,
  // desde el botón de este correo. Aplica a AMBOS métodos de pago (antes
  // solo a contraentrega): el pago completo también necesita que alguien
  // lleve el cuadro a la transportadora, solo que sin monto a recaudar.
  const trackingRow = trackingNumber
    ? `
      <tr>
        <td style="padding:0 20px 16px 20px;">
          <table class="email-banner-success-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.successBg};border-radius:6px;">
            <tr>
              <td style="padding:10px 14px;">
                <p class="email-text-success" style="margin:0;font-family:${FONT_STACK};font-size:13px;font-weight:bold;color:${BRAND.success};">
                  🚚 Guía generada (${carrierName || "transportadora"}): ${trackingNumber}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
    : `
      <tr>
        <td style="padding:0 20px 16px 20px;">
          <table class="email-banner-lilac-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.lilac};border-radius:6px;">
            <tr>
              <td style="padding:14px;text-align:center;">
                <p class="email-text-brand" style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:13px;color:${BRAND.text};">Guía de envío pendiente — generarla cuando el cuadro esté listo.</p>
                ${
                  manualShipmentUrl
                    ? `<a class="email-btn-bg email-text-white" href="${manualShipmentUrl}" style="display:inline-block;background-color:${BRAND.solid};color:#ffffff;font-family:${FONT_STACK};font-size:17px;font-weight:bold;text-decoration:none;border-radius:999px;padding:18px 32px;">✅ Ya fabriqué el cuadro - generar guía</a>`
                    : ""
                }
                ${
                  fabricanteUrl
                    ? `<p style="margin:12px 0 0 0;"><a class="email-text-brand" href="${fabricanteUrl}" style="display:inline-block;font-family:${FONT_STACK};font-size:13px;font-weight:bold;color:${BRAND.text};text-decoration:underline;">💰 Ver mis ganancias</a></p>`
                    : ""
                }
                ${
                  shipmentError
                    ? `<p class="email-text-warning" style="margin:10px 0 0 0;font-family:${FONT_STACK};font-size:12px;color:${BRAND.warning};">Último intento fallido — motivo: ${escapeHtml(shipmentError)}</p>`
                    : ""
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;

  return `
<table class="email-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.sky}" style="background-color:${BRAND.sky};padding:32px 12px;font-family:${FONT_STACK};">
  <tr>
    <td align="center">
      <table class="email-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.card}" style="max-width:520px;background-color:${BRAND.card};border-radius:20px;overflow:hidden;">
        ${emailHeaderRow("Nuevo pedido")}

        <!-- Bloque prioritario: lo que se necesita primero para despachar. -->
        <tr>
          <td style="padding:16px 20px 4px 20px;">
            <p class="email-text-faint" style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Nombre</p>
            <p class="email-text-ink" style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:15px;font-weight:bold;color:${BRAND.ink};">${customer.fullName}</p>

            <p class="email-text-faint" style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Teléfono</p>
            <p class="email-text-ink" style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:15px;font-weight:bold;color:${BRAND.ink};">${customer.phonePrefix} ${customer.phone}</p>

            <p class="email-text-faint" style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Ciudad</p>
            <p class="email-text-ink" style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:15px;font-weight:bold;color:${BRAND.ink};">${customer.city}</p>

            <p class="email-text-faint" style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Barrio</p>
            <p class="email-text-ink" style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:15px;font-weight:bold;color:${BRAND.ink};">${customer.neighborhood}</p>

            <p class="email-text-faint" style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Dirección</p>
            <p class="email-text-ink" style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:15px;font-weight:bold;color:${BRAND.ink};">${customer.street} · ${customer.housingType === "apartamento" ? "Apartamento" : "Casa"}</p>

            <p class="email-text-faint" style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Indicaciones adicionales</p>
            ${housingDetailsRows(customer) || `<p class="email-text-muted" style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.muted};">-</p>`}
          </td>
        </tr>

        <tr>
          <td style="padding:8px 20px 16px 20px;">
            ${paymentBanner}
          </td>
        </tr>

        <tr>
          <td style="padding:0 20px 16px 20px;">
            ${frameTypeBanner}
          </td>
        </tr>

        ${trackingRow}

        ${aiUpscaleNote}

        <!-- Nota de la imagen adjunta, justo después del bloque prioritario. -->
        <tr>
          <td style="padding:0 20px 16px 20px;">
            <table class="email-banner-lilac-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.lilac};border-left:4px solid ${BRAND.solid};">
              <tr>
                <td style="padding:12px 14px;">
                  <p class="email-text-bleed-note" style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:19px;color:#4c1d95;">
                    📎 La imagen adjunta incluye <strong>1 cm de sangrado por lado</strong> sobre el tamaño solicitado (<strong>${order.sizeLabel}</strong>). Recortar al tamaño final tras imprimir.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Resto de la info, después del bloque prioritario. -->
        <tr>
          <td style="padding:14px 20px 18px 20px;border-top:1px solid ${BRAND.border};">
            <p class="email-text-faint" style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Referencia</p>
            <p class="email-text-ink" style="margin:0 0 12px 0;font-family:'Courier New',Courier,monospace;font-size:14px;font-weight:bold;color:${BRAND.ink};word-break:break-all;">${transaction.reference}</p>

            <p class="email-text-faint" style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Tamaño</p>
            <p class="email-text-muted" style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.muted};">${order.sizeLabel} · ${isPremium ? "Premium" : "Tradicional"}</p>

            <p class="email-text-faint" style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Precio</p>
            <p class="email-text-muted" style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.muted};">${formatCOP(order.priceCOP)}</p>

            <p class="email-text-faint" style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Cliente recurrente</p>
            <p class="email-text-muted" style="margin:0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.muted};">${isReturningCustomer ? "Sí" : "No"}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:6px 20px;border-top:1px solid ${BRAND.border};">
            <p class="email-text-faint" style="margin:0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};">Correo: ${customer.email}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `;
}

export async function sendOrderEmails({
  order,
  customer,
  transaction,
  isReturningCustomer,
  paymentMethod = "wompi",
  trackingNumber,
  carrierName,
  labelUrl,
  shipmentError,
  anticipoPagado,
  saldoPendiente,
  // Para pedidos de /producto/[id] (catálogo): el llamador ya descargó el
  // archivo real de "Original (Portafolio)" desde Drive server-side (ver
  // app/lib/catalogPurchase.js) — ese buffer, ya en base64, tiene
  // prioridad sobre order.printImage (que para estos pedidos es solo la
  // miniatura pública del mockup, no el archivo de imprenta real).
  printImageBase64Override,
  // Solo para scripts/pruebas puntuales (ver scripts/send-test-emails.mjs):
  // subjectPrefix se antepone al asunto ("[PRUEBA] ..."), y
  // testRecipientOverride reemplaza TODOS los destinatarios reales
  // (fabricante y cliente) por uno solo, para poder ver el diseño en una
  // bandeja real sin arriesgarse a mandarle un correo de prueba a un
  // fabricante o cliente real. Ninguno de los dos se usa en producción.
  subjectPrefix = "",
  testRecipientOverride,
}) {
  // El fabricante recibe la versión CON sangrado de producción
  // (order.printImage); si por algún motivo no viene (pedidos guardados
  // antes de agregar el sangrado), se usa la imagen normal como respaldo.
  // extractImageBase64 valida el formato antes de adjuntar, así que un dato
  // corrupto o ausente simplemente no se adjunta en vez de mandar un PNG
  // roto.
  const printBase64 =
    printImageBase64Override ||
    extractImageBase64(order.printImage) ||
    extractImageBase64(order.croppedImage);
  if (!printBase64) {
    console.error(
      "[email] order.printImage/croppedImage no es un data URL de imagen válido — no se adjuntará ningún archivo al correo del fabricante."
    );
  }

  // printImageBase64Override (catálogo, ver catalogPurchase.js) siempre es
  // PNG — es el archivo maestro que sube /estudio. Para pedidos de /crear
  // (foto propia), order.printImage/croppedImage ahora se generan como
  // JPEG (ver cropImage.js) para no exceder el límite de payload de
  // Vercel, así que la extensión real del adjunto depende de cuál de los
  // dos terminó usándose.
  const printExtension = printImageBase64Override
    ? "png"
    : order.printImage?.startsWith("data:image/jpeg") ||
        (!order.printImage && order.croppedImage?.startsWith("data:image/jpeg"))
      ? "jpg"
      : "png";

  // Etiqueta de envío (PDF) — solo presente cuando la guía ya se generó
  // (ver app/api/generate-shipment/route.js); en el correo inicial del
  // pedido normalmente todavía no existe.
  const labelBase64 = await fetchLabelPdfBase64(labelUrl);

  // Link firmado del botón "generar guía ahora" — se calcula siempre
  // (no solo cuando falta la guía) por simplicidad; adminEmailHtml decide
  // si lo muestra según trackingNumber. Mismo patrón que
  // generateReviewToken/sendReviewRequestEmail (HMAC sobre el reference,
  // sin estado — ver app/lib/manualShipmentToken.js).
  const manualShipmentUrl = `${SITE_URL}/api/generate-shipment?ref=${encodeURIComponent(
    transaction.reference
  )}&token=${encodeURIComponent(generateManualShipmentToken(transaction.reference))}`;

  // Link a /fabricante con el código de acceso del fabricante correspondiente
  // a este pedido (order.frameType) ya incluido (mismo criterio que
  // manualShipmentUrl arriba): el correo llega SOLO a ese fabricante (ver
  // adminRecipientsForFrameType), así que es el mismo límite de confianza
  // que ya asumimos para el botón de generar guía — pedirle que escriba el
  // código a mano cada vez que quiere ver su saldo es fricción sin
  // beneficio real de seguridad. Si el fabricante no tiene accessCode
  // configurado, el link igual funciona, solo que le pide el código
  // manualmente.
  const fabricanteForOrder = getFabricanteForFrameType(order.frameType);
  const fabricanteUrl = fabricanteForOrder?.accessCode
    ? `${SITE_URL}/fabricante?code=${encodeURIComponent(fabricanteForOrder.accessCode)}`
    : `${SITE_URL}/fabricante`;

  const attachments = [];
  if (printBase64) {
    attachments.push({ filename: `cuadro-mystery.${printExtension}`, content: printBase64 });
  }
  if (labelBase64) {
    attachments.push({ filename: "guia-envio.pdf", content: labelBase64 });
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: testRecipientOverride || adminRecipientsForFrameType(order.frameType),
    subject: `${subjectPrefix}Nuevo pedido Mystery - ${customer.fullName}`,
    html: wrapEmailHtml(
      adminEmailHtml({
        order,
        customer,
        transaction,
        isReturningCustomer,
        paymentMethod,
        trackingNumber,
        carrierName,
        shipmentError,
        manualShipmentUrl,
        fabricanteUrl,
        anticipoPagado,
        saldoPendiente,
      })
    ),
    attachments,
  });

  // Sin imagen en el correo al cliente por ahora: un cid: de adjunto no
  // resuelve como imagen visible en la mayoría de clientes de correo (Gmail
  // incluido) — necesitarían una URL pública, que todavía no tenemos. El
  // cliente no necesita el adjunto tampoco (es solo para el fabricante), así
  // que confirmamos tamaño y precio en texto/tarjeta sin depender de la foto.
  await resend.emails.send({
    from: FROM_EMAIL,
    to: testRecipientOverride || customer.email,
    subject: `${subjectPrefix}¡Tu cuadro Mystery está confirmado!`,
    html: wrapEmailHtml(
      customerEmailHtml({
        order,
        customer,
        isReturningCustomer,
        paymentMethod,
        anticipoPagado,
        saldoPendiente,
      })
    ),
  });
}

// ---------------------------------------------------------------------
// Correo de aviso al admin — el fabricante canceló una guía desde su
// panel (ver app/api/fabricante-cancel-shipment/route.js). Va SOLO a
// ADMIN_EMAIL (no al fabricante que corresponde al pedido) — es un aviso
// PARA el admin SOBRE algo que hizo el fabricante, mandárselo también a
// él sería redundante.
// ---------------------------------------------------------------------

function guideCancelledEmailHtml({ order, customer, reference, reason, trackingNumber, carrierName }) {
  return `
<table class="email-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.sky}" style="background-color:${BRAND.sky};padding:32px 12px;font-family:${FONT_STACK};">
  <tr>
    <td align="center">
      <table class="email-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.card}" style="max-width:520px;background-color:${BRAND.card};border-radius:20px;overflow:hidden;">
        ${emailHeaderRow()}
        <tr>
          <td style="padding:16px 20px 0 20px;">
            <table class="email-banner-warning-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.warningBg};border-radius:8px;">
              <tr>
                <td style="padding:12px 14px;">
                  <p class="email-text-warning" style="margin:0;font-family:${FONT_STACK};font-size:14px;font-weight:bold;color:${BRAND.warning};">⚠️ Guía cancelada por el fabricante</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px;">
            <p class="email-text-faint" style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Cliente</p>
            <p class="email-text-ink" style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:15px;font-weight:bold;color:${BRAND.ink};">${escapeHtml(customer.fullName)}</p>

            <p class="email-text-faint" style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Ciudad</p>
            <p class="email-text-muted" style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:15px;color:${BRAND.muted};">${escapeHtml(customer.city)}</p>

            <p class="email-text-faint" style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Tamaño</p>
            <p class="email-text-muted" style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:15px;color:${BRAND.muted};">${escapeHtml(order.sizeLabel || order.sizeId)}</p>

            <p class="email-text-faint" style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Guía cancelada</p>
            <p class="email-text-ink" style="margin:0 0 12px 0;font-family:'Courier New',Courier,monospace;font-size:14px;color:${BRAND.ink};">${escapeHtml(trackingNumber || "-")} ${carrierName ? `(${escapeHtml(carrierName)})` : ""}</p>

            <p class="email-text-faint" style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Referencia</p>
            <p class="email-text-ink" style="margin:0 0 12px 0;font-family:'Courier New',Courier,monospace;font-size:14px;color:${BRAND.ink};word-break:break-all;">${escapeHtml(reference)}</p>

            <table class="email-banner-warning-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.warningBg};border-radius:6px;">
              <tr>
                <td style="padding:12px 14px;">
                  <p class="email-text-warning" style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.warning};text-transform:uppercase;letter-spacing:0.4px;">Motivo del fabricante</p>
                  <p class="email-text-ink" style="margin:0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.ink};">${escapeHtml(reason)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `;
}

export async function sendGuideCancelledEmail({
  order,
  customer,
  reference,
  reason,
  trackingNumber,
  carrierName,
  subjectPrefix = "",
  testRecipientOverride,
}) {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: testRecipientOverride || ADMIN_EMAIL,
    subject: `${subjectPrefix}⚠️ Guía cancelada por el fabricante`,
    html: wrapEmailHtml(
      guideCancelledEmailHtml({ order, customer, reference, reason, trackingNumber, carrierName })
    ),
  });
}

// ---------------------------------------------------------------------
// Correo de "solicitud de pago" — botón "Cobrar saldo" en /fabricante
// (ver app/api/fabricante-request-payment/route.js). Va SIEMPRE a
// bigmysteryof@gmail.com — la bandeja de Oscar para este aviso puntual,
// fija a propósito y NUNCA acoplada a MANUFACTURER_EMAIL: ese env var es
// el correo del fabricante REAL (usado para copiarlo en los pedidos y
// como contacto de origen en Skydropx), así que si se reutilizara acá el
// aviso de "me deben plata" terminaría mandándosele al propio fabricante
// en vez de a Oscar.
// ---------------------------------------------------------------------

const OWNER_PAYMENT_REQUEST_EMAIL = "bigmysteryof@gmail.com";

const FABRICANTE_DISPLAY_NAME = {
  daniela: "Daniela (Premium)",
  oscar: "Oscar (Tradicional)",
};

function paymentRequestEmailHtml({ amount, fabricanteId }) {
  const fabricanteLabel = FABRICANTE_DISPLAY_NAME[fabricanteId] || "Fabricante";
  return `
<table class="email-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.sky}" style="background-color:${BRAND.sky};padding:32px 12px;font-family:${FONT_STACK};">
  <tr>
    <td align="center">
      <table class="email-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.card}" style="max-width:480px;background-color:${BRAND.card};border-radius:20px;overflow:hidden;">
        ${emailHeaderRow()}
        <tr>
          <td style="padding:28px;">
            <p class="email-text-ink" style="margin:0 0 16px 0;font-family:${FONT_STACK};font-size:16px;line-height:23px;color:${BRAND.ink};">${fabricanteLabel} solicitó pago: <strong class="email-text-brand" style="color:${BRAND.text};">${formatCOP(amount)}</strong></p>
            <p class="email-text-muted" style="margin:0 0 24px 0;font-family:${FONT_STACK};font-size:14px;line-height:20px;color:${BRAND.muted};">Confírmalo desde el panel de administración cuando le hayas transferido.</p>
            <p style="margin:0;text-align:center;">
              <a class="email-btn-bg email-text-white" href="${SITE_URL}/admin" style="display:inline-block;background-color:${BRAND.solid};color:#ffffff;font-family:${FONT_STACK};font-size:15px;font-weight:bold;text-decoration:none;border-radius:999px;padding:14px 32px;">Ir a /admin</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `;
}

// El fabricanteId solo identifica DE QUIÉN es el saldo (para mostrarlo en
// el cuerpo del correo) — el DESTINATARIO siempre es OWNER_PAYMENT_REQUEST_EMAIL,
// nunca depende de qué fabricante lo solicitó (ver comentario arriba y
// app/api/fabricante-request-payment/route.js).
export async function sendFabricantePaymentRequestEmail({
  amount,
  fabricanteId,
  subjectPrefix = "",
  testRecipientOverride,
}) {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: testRecipientOverride || OWNER_PAYMENT_REQUEST_EMAIL,
    subject: `${subjectPrefix}PAGO A FABRICANTE - MYSTERY CUADROS`,
    html: wrapEmailHtml(paymentRequestEmailHtml({ amount, fabricanteId })),
  });
}

// ---------------------------------------------------------------------
// Correo de "guía generada" al cliente — disparado desde
// app/api/generate-shipment/route.js justo después de que
// createManualShipment() devuelve tracking_number + label_url reales
// (nunca solo por confirmar el pago; ver app/lib/skydropx.js). Aplica a
// pedidos contraentrega y de pago completo por igual.
// ---------------------------------------------------------------------

function shippingNotificationEmailHtml({
  customer,
  trackingNumber,
  carrierName,
  trackingUrl,
  labelUrl,
  saldoPendiente,
}) {
  // Preferimos el link de rastreo real de la transportadora; si Skydropx no
  // lo da, el label_url es lo único que le sirve al cliente para hacer
  // seguimiento (ver app/lib/skydropx.js).
  const linkToShow = trackingUrl || labelUrl;

  return `
<table class="email-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.sky}" style="background-color:${BRAND.sky};padding:32px 12px;font-family:${FONT_STACK};">
  <tr>
    <td align="center">
      <table class="email-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.card}" style="max-width:560px;background-color:${BRAND.card};border-radius:20px;overflow:hidden;">
        ${emailHeaderRow()}

        <tr>
          <td style="padding:32px 32px 8px 32px;">
            <p class="email-text-ink" style="margin:0 0 6px 0;font-family:${FONT_STACK};font-size:20px;font-weight:bold;color:${BRAND.ink};">¡Hola ${customer.fullName}! Tu pedido ya fue despachado.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:12px 32px 4px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.border};border-radius:10px;">
              <tr>
                <td style="padding:18px;">
                  <p class="email-text-faint" style="margin:0 0 10px 0;font-family:${FONT_STACK};font-size:13px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Número de guía</p>
                  <p class="email-text-ink" style="margin:0 0 16px 0;font-family:'Courier New',Courier,monospace;font-size:18px;font-weight:bold;color:${BRAND.ink};">${trackingNumber}</p>

                  <p class="email-text-faint" style="margin:0 0 4px 0;font-family:${FONT_STACK};font-size:13px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Transportadora</p>
                  <p class="email-text-ink" style="margin:0;font-family:${FONT_STACK};font-size:15px;color:${BRAND.ink};">${carrierName || "-"}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${
          linkToShow
            ? `
        <tr>
          <td style="padding:20px 32px 4px 32px;" align="center">
            <a class="email-btn-bg email-text-white" href="${linkToShow}" style="display:inline-block;background-color:${BRAND.solid};color:#ffffff;font-family:${FONT_STACK};font-size:15px;font-weight:bold;text-decoration:none;border-radius:999px;padding:13px 28px;">Rastrear mi envío</a>
          </td>
        </tr>
        `
            : ""
        }

        ${
          saldoPendiente > 0
            ? `
        <tr>
          <td style="padding:20px 32px 4px 32px;">
            <table class="email-banner-success-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.successBg};border-radius:8px;">
              <tr>
                <td style="padding:12px 16px;">
                  <p class="email-text-success" style="margin:0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.success};">💵 Saldo a pagar al recibir: <strong>${formatCOP(saldoPendiente)}</strong></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        `
            : ""
        }

        <tr>
          <td style="padding:20px 32px 8px 32px;">
            <p class="email-text-muted" style="margin:0;font-family:${FONT_STACK};font-size:14px;line-height:21px;color:${BRAND.muted};">Tiempo estimado de entrega: <strong class="email-text-ink" style="color:${BRAND.ink};">3 a 5 días hábiles.</strong></p>
          </td>
        </tr>

        <tr>
          <td style="padding:8px 32px 32px 32px;">
            <p class="email-text-muted" style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:22px;color:${BRAND.muted};">¡Gracias por comprar en Mystery! 💜</p>
          </td>
        </tr>

        <tr>
          <td class="email-footer-bg" style="background-color:#fafafa;border-top:1px solid ${BRAND.border};padding:20px 32px;">
            <p class="email-text-faint" style="margin:0 0 6px 0;font-family:${FONT_STACK};font-size:12px;color:${BRAND.faint};">Mystery · ${ADMIN_EMAIL}</p>
            <p class="email-text-faint" style="margin:0;font-family:${FONT_STACK};font-size:12px;color:${BRAND.faint};">Correo enviado automáticamente, no responder.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `;
}

// trackingUrl y labelUrl pueden venir null (ver app/lib/skydropx.js) — el
// html arriba ya maneja el caso de que ninguno esté disponible ocultando
// el botón de rastreo. Nunca se llama si no hay trackingNumber (ver
// app/api/generate-shipment/route.js).
//
// scheduledAt: usa la programación nativa de Resend (acepta lenguaje
// natural como "in 2 hours" o un ISO timestamp) para que este correo
// salga un par de horas después de que el fabricante confirme la guía —
// no inmediatamente, para dar margen a que el cuadro efectivamente salga
// hacia la transportadora. Si se omite, el correo sale de inmediato.
// Devuelve el id que asigna Resend al correo (el mismo que después acepta
// resend.emails.cancel(id)) — o null si el envío/programación falló, para
// que el llamador sepa que no hay nada que guardar. Necesario para poder
// cancelar el correo "va en camino" si el fabricante cancela la guía
// antes de que Resend lo dispare (ver saveScheduledEmailId en
// app/lib/manualShipments.js y app/api/fabricante-cancel-shipment/route.js).
export async function sendShippingNotificationEmail({
  customer,
  trackingNumber,
  carrierName,
  trackingUrl,
  labelUrl,
  saldoPendiente,
  scheduledAt,
  subjectPrefix = "",
  testRecipientOverride,
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: testRecipientOverride || customer.email,
    subject: `${subjectPrefix}Tu cuadro va en camino`,
    html: wrapEmailHtml(
      shippingNotificationEmailHtml({
        customer,
        trackingNumber,
        carrierName,
        trackingUrl,
        labelUrl,
        saldoPendiente,
      })
    ),
    ...(scheduledAt ? { scheduledAt } : {}),
  });

  if (error) {
    console.error("[email] Falló el envío/programación de 'va en camino':", error);
    return null;
  }
  return data?.id || null;
}

// Cancela un correo programado en Resend (usado cuando el fabricante
// cancela una guía antes de que salga el aviso de "va en camino" — ver
// app/api/fabricante-cancel-shipment/route.js). Resend devuelve error
// cuando el correo ya no se puede cancelar (ya se envió, o el id no
// existe/ya estaba cancelado) — eso NO es un fallo del servidor, es el
// caso esperado que el llamador usa para decidir si hace falta mandar un
// correo de corrección en su lugar.
export async function cancelScheduledEmail(emailId) {
  if (!emailId) return { cancelled: false, alreadySentOrInvalid: true };

  const { error } = await resend.emails.cancel(emailId);
  if (error) {
    console.warn(
      `[email] No se pudo cancelar el correo programado ${emailId} (probablemente ya se envió):`,
      error
    );
    return { cancelled: false, alreadySentOrInvalid: true, error };
  }
  return { cancelled: true, alreadySentOrInvalid: false };
}

// ---------------------------------------------------------------------
// Correo de corrección al cliente — se manda SOLO cuando el fabricante
// cancela una guía y el aviso de "va en camino" original YA se había
// enviado (cancelScheduledEmail no pudo evitarlo, ver
// app/api/fabricante-cancel-shipment/route.js). A propósito NO menciona
// "cancelación" ni detalles internos — es informativo y tranquilizador:
// el cliente ya vio un número de guía real, así que hay que avisarle que
// ese específico ya no sirve sin sonar alarmante.
// ---------------------------------------------------------------------

function guideCorrectionEmailHtml({ customer }) {
  return `
<table class="email-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.sky}" style="background-color:${BRAND.sky};padding:32px 12px;font-family:${FONT_STACK};">
  <tr>
    <td align="center">
      <table class="email-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.card}" style="max-width:560px;background-color:${BRAND.card};border-radius:20px;overflow:hidden;">
        ${emailHeaderRow()}

        <tr>
          <td style="padding:32px 32px 8px 32px;">
            <p class="email-text-ink" style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:20px;font-weight:bold;color:${BRAND.ink};">¡Hola ${escapeHtml(customer.fullName)}!</p>
            <p class="email-text-muted" style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:22px;color:${BRAND.muted};">
              El número de guía que recibiste antes ya no es válido — tuvimos que hacer un ajuste en el envío. Tu pedido sigue en proceso y te vamos a escribir de nuevo apenas tengamos la guía correcta, con el número actualizado.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:8px 32px 32px 32px;">
            <p class="email-text-muted" style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:22px;color:${BRAND.muted};">Gracias por tu paciencia. ¡Gracias por comprar en Mystery! 💜</p>
          </td>
        </tr>

        <tr>
          <td class="email-footer-bg" style="background-color:#fafafa;border-top:1px solid ${BRAND.border};padding:20px 32px;">
            <p class="email-text-faint" style="margin:0 0 6px 0;font-family:${FONT_STACK};font-size:12px;color:${BRAND.faint};">Mystery · ${ADMIN_EMAIL}</p>
            <p class="email-text-faint" style="margin:0;font-family:${FONT_STACK};font-size:12px;color:${BRAND.faint};">¿Dudas con tu pedido? Responde este correo, con gusto te ayudamos.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `;
}

export async function sendGuideCorrectionEmail({ customer, subjectPrefix = "", testRecipientOverride }) {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: testRecipientOverride || customer.email,
    subject: `${subjectPrefix}Actualización sobre tu envío Mystery`,
    html: wrapEmailHtml(guideCorrectionEmailHtml({ customer })),
  });
}

// ---------------------------------------------------------------------
// Correo de solicitud de reseña (disparado por el cron, ver
// app/api/cron/send-review-emails/route.js)
// ---------------------------------------------------------------------

function reviewRequestEmailHtml({ order, reviewUrl }) {
  return `
<table class="email-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.sky}" style="background-color:${BRAND.sky};padding:32px 12px;font-family:${FONT_STACK};">
  <tr>
    <td align="center">
      <table class="email-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.card}" style="max-width:560px;background-color:${BRAND.card};border-radius:20px;overflow:hidden;">
        ${emailHeaderRow()}

        <tr>
          <td style="padding:32px 32px 8px 32px;">
            <p class="email-text-ink" style="margin:0 0 6px 0;font-family:${FONT_STACK};font-size:20px;font-weight:bold;color:${BRAND.ink};">¿Qué te pareció tu cuadro?</p>
            <p class="email-text-muted" style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:22px;color:${BRAND.muted};">
              Ya debería haber llegado tu cuadro${order.sizeLabel ? ` (${order.sizeLabel})` : ""}. Nos ayudaría mucho que nos cuentes qué te pareció — toma menos de un minuto.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 32px 32px;" align="center">
            <a class="email-btn-bg email-text-white" href="${reviewUrl}" style="display:inline-block;background-color:${BRAND.solid};color:#ffffff;font-family:${FONT_STACK};font-size:16px;font-weight:bold;text-decoration:none;border-radius:999px;padding:14px 32px;">Dejar mi reseña</a>
          </td>
        </tr>

        <tr>
          <td style="padding:0 32px 28px 32px;">
            <p class="email-text-faint" style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:18px;color:${BRAND.faint};text-align:center;">Si el botón no funciona, copia y pega este link en tu navegador:<br>${reviewUrl}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `;
}

// `order` acá es un registro de completedOrders.js (reference,
// sizeLabel, ...), NO el order completo del checkout — el cron nunca
// tiene acceso al pedido completo de IndexedDB, solo a lo que se
// guardó server-side al confirmar el pago.
export async function sendReviewRequestEmail({ order, token, subjectPrefix = "", testRecipientOverride }) {
  const reviewUrl = `${SITE_URL}/resena?ref=${encodeURIComponent(order.reference)}&token=${encodeURIComponent(token)}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: testRecipientOverride || order.customerEmail,
    subject: `${subjectPrefix}¿Qué te pareció tu cuadro Mystery?`,
    html: wrapEmailHtml(reviewRequestEmailHtml({ order, reviewUrl })),
  });
}

// Correo único de recuperación de carrito abandonado (ver
// /api/cron/send-cart-recovery-emails) — tono cálido, sin presión ni
// descuento todavía; esto es el primer correo simple, no una secuencia.
// `order`/`customer` acá SÍ son los objetos completos guardados en el
// pending-order (ver pendingOrders.js), no un registro resumido como en
// completedOrders.js — por eso hay sizeLabel/priceCOP directo del order.
function cartRecoveryEmailHtml({ customer, order, resumeUrl }) {
  const firstName = (customer.fullName || "").trim().split(/\s+/)[0] || "";

  return `
<table class="email-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.sky}" style="background-color:${BRAND.sky};padding:32px 12px;font-family:${FONT_STACK};">
  <tr>
    <td align="center">
      <table class="email-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.card}" style="max-width:560px;background-color:${BRAND.card};border-radius:20px;overflow:hidden;">
        ${emailHeaderRow()}

        <tr>
          <td style="padding:32px 32px 8px 32px;">
            <p class="email-text-ink" style="margin:0 0 6px 0;font-family:${FONT_STACK};font-size:20px;font-weight:bold;color:${BRAND.ink};">
              ${firstName ? `¡Hola, ${firstName}!` : "¡Hola!"} Tu cuadro te está esperando
            </p>
            <p class="email-text-muted" style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:22px;color:${BRAND.muted};">
              Notamos que empezaste a crear tu cuadro personalizado${
                order.sizeLabel ? ` (${order.sizeLabel})` : ""
              } pero no alcanzaste a terminar el pago. Sigue exactamente donde lo dejaste — no tienes que subir tu foto ni ajustarla de nuevo.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:8px 32px 24px 32px;">
            <table class="email-banner-lilac-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.lilac};border-radius:10px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p class="email-text-ink" style="margin:0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.ink};">
                    ${order.sizeLabel ? `<strong>Tamaño:</strong> ${order.sizeLabel}<br>` : ""}
                    ${
                      typeof order.priceCOP === "number"
                        ? `<strong>Total:</strong> ${formatCOP(order.priceCOP)}`
                        : ""
                    }
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 32px 32px 32px;" align="center">
            <a class="email-btn-bg email-text-white" href="${resumeUrl}" style="display:inline-block;background-color:${BRAND.solid};color:#ffffff;font-family:${FONT_STACK};font-size:16px;font-weight:bold;text-decoration:none;border-radius:999px;padding:14px 32px;">Continuar con mi pedido</a>
          </td>
        </tr>

        <tr>
          <td style="padding:0 32px 28px 32px;">
            <p class="email-text-faint" style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:18px;color:${BRAND.faint};text-align:center;">Si el botón no funciona, copia y pega este link en tu navegador:<br>${resumeUrl}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `;
}

export async function sendCartRecoveryEmail({
  order,
  customer,
  reference,
  token,
  subjectPrefix = "",
  testRecipientOverride,
}) {
  const resumeUrl = `${SITE_URL}/checkout?resume=${encodeURIComponent(reference)}&token=${encodeURIComponent(token)}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: testRecipientOverride || customer.email,
    subject: `${subjectPrefix}Tu cuadro personalizado te está esperando`,
    html: wrapEmailHtml(cartRecoveryEmailHtml({ customer, order, resumeUrl })),
  });
}
