import { Resend } from "resend";
import { formatCOP } from "./order";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Mystery <pedidos@elmetacho.com>";
const ADMIN_EMAIL = "contacto@elmetacho.com";
const ADMIN_RECIPIENTS = [ADMIN_EMAIL, process.env.MANUFACTURER_EMAIL].filter(
  Boolean
);

// Sin cuenta de Instagram real configurada todavía — mismo placeholder que
// se usa en el resto del sitio (Home, /checkout/confirmacion).
const INSTAGRAM_URL = "#";

// Paleta de marca para HTML de correo: los clientes de correo (sobre todo
// Outlook de escritorio) no soportan CSS moderno (custom properties, flex,
// grid), así que todo va con estilos inline y valores hex directos en vez
// de var(--accent). Un morado ligeramente más oscuro (TEXT) se usa para
// texto sobre fondo blanco por contraste; el morado de marca "puro"
// (SOLID) se usa para fondos/badges con texto claro encima.
const BRAND = {
  solid: "#a855f7",
  soft: "#c084fc",
  text: "#7c3aed", // más oscuro que --accent, para legibilidad sobre blanco
  dark: "#14101c",
  ink: "#18181b",
  muted: "#52525b",
  faint: "#71717a",
  border: "#e4e4e7",
  bgOuter: "#f2eff9",
  bgAdminOuter: "#f4f4f5",
  lilac: "#f5f0ff",
  success: "#166534",
  successBg: "#dcfce7",
  warning: "#92400e",
  warningBg: "#fef3c7",
};

const FONT_STACK = "Arial, Helvetica, sans-serif";

function housingDetailsRows(customer) {
  if (customer.housingType === "apartamento") {
    return `
      <p style="margin:0;font-size:14px;line-height:21px;color:${BRAND.muted};">Edificio ${customer.buildingName || "-"}${customer.tower ? `, Torre ${customer.tower}` : ""}, Apto ${customer.apartmentNumber || "-"}</p>
    `;
  }
  if (customer.additionalInstructions) {
    return `
      <p style="margin:0;font-size:14px;line-height:21px;color:${BRAND.muted};">${customer.additionalInstructions}</p>
    `;
  }
  return "";
}

// ---------------------------------------------------------------------
// Correo al cliente
// ---------------------------------------------------------------------

function customerEmailHtml({ order, customer, isReturningCustomer }) {
  const loyaltyBlock = isReturningCustomer
    ? `
      <tr>
        <td style="padding:0 32px 24px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.lilac};border:1px dashed ${BRAND.solid};border-radius:10px;">
            <tr>
              <td style="padding:18px;text-align:center;">
                <p style="margin:0 0 4px 0;font-family:${FONT_STACK};font-size:16px;font-weight:bold;color:${BRAND.text};">¡Eres cliente fiel! 🎉</p>
                <p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:13px;color:${BRAND.muted};">Tienes 10% de descuento en tu próxima compra</p>
                <span style="display:inline-block;background-color:#ffffff;border:1px solid ${BRAND.solid};border-radius:6px;padding:8px 18px;font-family:'Courier New',Courier,monospace;font-size:14px;font-weight:bold;color:${BRAND.ink};letter-spacing:1px;">MYSTERY10%</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
    : "";

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.bgOuter};padding:32px 12px;font-family:${FONT_STACK};">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background-color:${BRAND.dark};padding:28px 32px;text-align:center;">
            <span style="font-family:${FONT_STACK};font-size:26px;font-weight:bold;color:${BRAND.soft};letter-spacing:0.5px;">Mystery</span>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 32px 8px 32px;">
            <p style="margin:0 0 6px 0;font-family:${FONT_STACK};font-size:20px;font-weight:bold;color:${BRAND.ink};">¡Gracias por tu pedido, ${customer.fullName}!</p>
            <p style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:22px;color:${BRAND.muted};">Confirmamos que tu pago fue aprobado y tu cuadro personalizado ya está en preparación.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px 4px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.border};border-radius:10px;">
              <tr>
                <td style="padding:18px;" align="center">
                  <p style="margin:0 0 4px 0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.muted};">${order.sizeLabel}</p>
                  <p style="margin:0;font-family:${FONT_STACK};font-size:22px;font-weight:bold;color:${BRAND.text};">${formatCOP(order.priceCOP)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px 8px 32px;">
            <p style="margin:0 0 10px 0;font-family:${FONT_STACK};font-size:12px;font-weight:bold;color:${BRAND.ink};text-transform:uppercase;letter-spacing:0.5px;">Próximos pasos</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:3px 0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.ink};">✅&nbsp; <strong>Pago confirmado</strong></td></tr>
              <tr><td style="padding:3px 0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.muted};">🎨&nbsp; En producción <span style="color:#a1a1aa;">(3-5 días hábiles)</span></td></tr>
              <tr><td style="padding:3px 0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.muted};">🚚&nbsp; Envío a tu dirección</td></tr>
            </table>
          </td>
        </tr>

        ${loyaltyBlock}

        <tr>
          <td style="padding:8px 32px 32px 32px;">
            <p style="margin:0;font-family:${FONT_STACK};font-size:14px;line-height:20px;color:${BRAND.muted};">Te avisaremos apenas tu cuadro esté en camino. ¡Gracias por confiar en Mystery!</p>
          </td>
        </tr>

        <tr>
          <td style="background-color:#fafafa;border-top:1px solid ${BRAND.border};padding:20px 32px;">
            <p style="margin:0 0 6px 0;font-family:${FONT_STACK};font-size:12px;color:${BRAND.faint};">Mystery · ${ADMIN_EMAIL}</p>
            <p style="margin:0 0 6px 0;font-family:${FONT_STACK};font-size:12px;color:${BRAND.faint};">Síguenos en <a href="${INSTAGRAM_URL}" style="color:${BRAND.text};text-decoration:none;">Instagram</a></p>
            <p style="margin:0;font-family:${FONT_STACK};font-size:12px;color:${BRAND.faint};">¿Dudas con tu pedido? Responde este correo, con gusto te ayudamos.</p>
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

function adminEmailHtml({ order, customer, transaction, isReturningCustomer }) {
  // En la práctica esta función solo se llama después de verificar el pago
  // con Wompi (ver app/api/confirm-order/route.js), así que isPaid siempre
  // debería ser true — igual se deja explícito y visible en vez de asumido.
  const isPaid = transaction.status === "APPROVED";

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.bgAdminOuter};padding:16px 10px;font-family:${FONT_STACK};">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border:1px solid ${BRAND.border};border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background-color:${BRAND.ink};padding:14px 20px;">
            <span style="font-family:${FONT_STACK};font-size:15px;font-weight:bold;color:${BRAND.soft};">Mystery</span>
            <span style="font-family:${FONT_STACK};font-size:15px;font-weight:bold;color:#ffffff;"> · Nuevo pedido</span>
          </td>
        </tr>

        <!-- Bloque prioritario: lo que se necesita primero para despachar. -->
        <tr>
          <td style="padding:16px 20px 4px 20px;">
            <p style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Nombre</p>
            <p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:15px;font-weight:bold;color:${BRAND.ink};">${customer.fullName}</p>

            <p style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Teléfono</p>
            <p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:15px;font-weight:bold;color:${BRAND.ink};">${customer.phonePrefix} ${customer.phone}</p>

            <p style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Ciudad</p>
            <p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:15px;font-weight:bold;color:${BRAND.ink};">${customer.city}</p>

            <p style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Barrio</p>
            <p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:15px;font-weight:bold;color:${BRAND.ink};">${customer.neighborhood}</p>

            <p style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Dirección</p>
            <p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:15px;font-weight:bold;color:${BRAND.ink};">${customer.street} · ${customer.housingType === "apartamento" ? "Apartamento" : "Casa"}</p>

            <p style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Indicaciones adicionales</p>
            ${housingDetailsRows(customer) || `<p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.muted};">-</p>`}
          </td>
        </tr>

        <tr>
          <td style="padding:8px 20px 16px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${isPaid ? BRAND.successBg : BRAND.warningBg};border-radius:6px;">
              <tr>
                <td style="padding:10px 14px;">
                  <p style="margin:0;font-family:${FONT_STACK};font-size:14px;font-weight:bold;color:${isPaid ? BRAND.success : BRAND.warning};">
                    Estado de pago: ${isPaid ? "✅ Pagado" : `⚠️ No confirmado (${transaction.status})`}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Nota de la imagen adjunta, justo después del bloque prioritario. -->
        <tr>
          <td style="padding:0 20px 16px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.lilac};border-left:4px solid ${BRAND.solid};">
              <tr>
                <td style="padding:12px 14px;">
                  <p style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:19px;color:#4c1d95;">
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
            <p style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Referencia</p>
            <p style="margin:0 0 12px 0;font-family:'Courier New',Courier,monospace;font-size:14px;font-weight:bold;color:${BRAND.ink};word-break:break-all;">${transaction.reference}</p>

            <p style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Tamaño</p>
            <p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.muted};">${order.sizeLabel}</p>

            <p style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Precio</p>
            <p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.muted};">${formatCOP(order.priceCOP)}</p>

            <p style="margin:0 0 2px 0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};text-transform:uppercase;letter-spacing:0.4px;">Cliente recurrente</p>
            <p style="margin:0;font-family:${FONT_STACK};font-size:14px;color:${BRAND.muted};">${isReturningCustomer ? "Sí" : "No"}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:6px 20px;border-top:1px solid ${BRAND.border};">
            <p style="margin:0;font-family:${FONT_STACK};font-size:11px;color:${BRAND.faint};">Correo: ${customer.email}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `;
}

export async function sendOrderEmails({ order, customer, transaction, isReturningCustomer }) {
  // El fabricante recibe la versión CON sangrado de producción
  // (order.printImage); si por algún motivo no viene (pedidos guardados
  // antes de agregar el sangrado), se usa la imagen normal como respaldo
  // en vez de no adjuntar nada.
  const printBase64 = (order.printImage || order.croppedImage)?.split(",")[1];

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_RECIPIENTS,
    subject: `Nuevo pedido Mystery - ${customer.fullName}`,
    html: adminEmailHtml({ order, customer, transaction, isReturningCustomer }),
    attachments: printBase64
      ? [{ filename: "cuadro-mystery.png", content: printBase64 }]
      : [],
  });

  // Sin imagen en el correo al cliente por ahora: un cid: de adjunto no
  // resuelve como imagen visible en la mayoría de clientes de correo (Gmail
  // incluido) — necesitarían una URL pública, que todavía no tenemos. El
  // cliente no necesita el adjunto tampoco (es solo para el fabricante), así
  // que confirmamos tamaño y precio en texto/tarjeta sin depender de la foto.
  await resend.emails.send({
    from: FROM_EMAIL,
    to: customer.email,
    subject: "¡Tu cuadro Mystery está confirmado!",
    html: customerEmailHtml({ order, customer, isReturningCustomer }),
  });
}
