import { Resend } from "resend";
import { formatCOP } from "./order";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Mystery <pedidos@elmetacho.com>";
const ADMIN_EMAIL = "contacto@elmetacho.com";
const ADMIN_RECIPIENTS = [ADMIN_EMAIL, process.env.MANUFACTURER_EMAIL].filter(
  Boolean
);

// Detalle de la vivienda (edificio/torre/apto o indicaciones de casa),
// según lo que Servientrega necesita para la entrega.
function housingDetailsHtml(customer) {
  if (customer.housingType === "apartamento") {
    return `
      <li><strong>Tipo de vivienda:</strong> Apartamento</li>
      <li><strong>Edificio:</strong> ${customer.buildingName || "-"}</li>
      <li><strong>Torre:</strong> ${customer.tower || "-"}</li>
      <li><strong>Apartamento:</strong> ${customer.apartmentNumber || "-"}</li>
    `;
  }
  return `
    <li><strong>Tipo de vivienda:</strong> Casa</li>
    <li><strong>Indicaciones adicionales:</strong> ${
      customer.additionalInstructions || "-"
    }</li>
  `;
}

function adminEmailHtml({ order, customer, transaction }) {
  return `
    <h2>Nuevo pedido Mystery</h2>
    <p><strong>Referencia de la transacción:</strong> ${transaction.reference}</p>
    <p><strong>Estado del pago:</strong> ${transaction.status}</p>

    <h3>Cuadro</h3>
    <ul>
      <li><strong>Tamaño:</strong> ${order.sizeLabel}</li>
      <li><strong>Precio:</strong> ${formatCOP(order.priceCOP)}</li>
    </ul>

    <h3>Cliente</h3>
    <ul>
      <li><strong>Nombre:</strong> ${customer.fullName}</li>
      <li><strong>Correo:</strong> ${customer.email}</li>
      <li><strong>Celular:</strong> ${customer.phonePrefix} ${customer.phone}</li>
    </ul>

    <h3>Dirección de envío (Servientrega)</h3>
    <ul>
      <li><strong>Dirección:</strong> ${customer.street}</li>
      ${housingDetailsHtml(customer)}
      <li><strong>Barrio:</strong> ${customer.neighborhood}</li>
      <li><strong>Ciudad:</strong> ${customer.city}</li>
    </ul>

    <p>La imagen final ajustada por el cliente va adjunta a este correo.</p>
  `;
}

function customerEmailHtml({ order, customer }) {
  return `
    <h2>¡Gracias por tu pedido, ${customer.fullName}!</h2>
    <p>Confirmamos que tu pago fue aprobado y tu cuadro personalizado Mystery ya está en preparación.</p>

    <h3>Resumen de tu pedido</h3>
    <ul>
      <li><strong>Tamaño:</strong> ${order.sizeLabel}</li>
      <li><strong>Precio pagado:</strong> ${formatCOP(order.priceCOP)}</li>
    </ul>

    <p>Tu cuadro entra ahora a producción. Tiempo estimado de entrega: <strong>3-5 días hábiles</strong>.</p>
    <p>Te avisaremos cuando esté en camino. ¡Gracias por confiar en Mystery!</p>
  `;
}

export async function sendOrderEmails({ order, customer, transaction }) {
  const base64Image = order.croppedImage?.split(",")[1];

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_RECIPIENTS,
    subject: `Nuevo pedido Mystery - ${customer.fullName}`,
    html: adminEmailHtml({ order, customer, transaction }),
    attachments: base64Image
      ? [{ filename: "cuadro-mystery.png", content: base64Image }]
      : [],
  });

  await resend.emails.send({
    from: FROM_EMAIL,
    to: customer.email,
    subject: "¡Tu cuadro Mystery está confirmado!",
    html: customerEmailHtml({ order, customer }),
  });
}
