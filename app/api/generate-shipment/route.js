import { isValidManualShipmentToken } from "../../lib/manualShipmentToken";
import {
  getManualShipmentRequest,
  markManualShipmentGenerated,
  saveScheduledEmailId,
} from "../../lib/manualShipments";
import { createManualShipment } from "../../lib/skydropx";
import { sendShippingNotificationEmail } from "../../lib/email";
import { recordManufacturerOrder } from "../../lib/manufacturerFinance";

// Botón "✅ Ya está listo — generar guía ahora" del correo al fabricante
// (ver app/lib/email.js) — dispara la creación REAL de la guía de
// Skydropx (dinero real, descuenta saldo) solo cuando el fabricante
// confirma que el cuadro ya está terminado, en vez de generarla
// automáticamente al pagar (ver CLAUDE.md, riesgo de que la guía venza
// esperando la producción).
//
// Diseño en dos pasos (GET no hace nada, POST sí actúa) a propósito: el
// link del correo es un <a href> normal (GET), pero muchos escáneres de
// seguridad de correo (Outlook Safe Links, gateways corporativos, etc.)
// "abren" automáticamente todos los links de un correo entrante para
// revisarlos por phishing — si el GET ya creara la guía, esos escáneres
// la crearían solos sin que el fabricante haga nada. Por eso el GET solo
// MUESTRA una página de confirmación con un botón real (<form
// method="POST">); solo un click humano de verdad llega a crear la guía.

const BRAND = {
  solid: "#a855f7",
  dark: "#14101c",
  soft: "#c084fc",
  ink: "#18181b",
  muted: "#52525b",
  border: "#e4e4e7",
  bgOuter: "#f2eff9",
  success: "#166534",
  successBg: "#dcfce7",
  warning: "#92400e",
  warningBg: "#fef3c7",
};
const FONT_STACK = "Arial, Helvetica, sans-serif";

// customer.fullName/city vienen de un formulario público (checkout);
// trackingNumber/carrierName/errorMessage vienen de la API de Skydropx —
// ninguno es de confianza ciega para insertar directo en HTML.
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPage({ title, bodyHtml }) {
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
</head>
<body style="margin:0;background-color:${BRAND.bgOuter};font-family:${FONT_STACK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:${BRAND.dark};padding:24px 28px;text-align:center;">
              <span style="font-size:22px;font-weight:bold;color:${BRAND.soft};letter-spacing:0.5px;">Mystery</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function invalidLinkPage() {
  return renderPage({
    title: "Link inválido — Mystery",
    bodyHtml: `<p style="margin:0;font-size:15px;color:${BRAND.ink};">Este link no es válido. Si crees que es un error, contacta a Mystery.</p>`,
  });
}

function notFoundPage() {
  return renderPage({
    title: "Pedido no encontrado — Mystery",
    bodyHtml: `<p style="margin:0;font-size:15px;color:${BRAND.ink};">No encontramos la solicitud de guía para este pedido (puede que ya haya vencido, 30 días después de la compra).</p>`,
  });
}

function alreadyGeneratedPage(record) {
  return renderPage({
    title: "Guía ya generada — Mystery",
    bodyHtml: `
      <p style="margin:0 0 16px 0;font-size:16px;font-weight:bold;color:${BRAND.ink};">✅ Esta guía ya se había generado antes.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.successBg};border-radius:8px;">
        <tr><td style="padding:14px 16px;">
          <p style="margin:0 0 4px 0;font-size:13px;color:${BRAND.success};">Número de guía</p>
          <p style="margin:0 0 10px 0;font-family:'Courier New',Courier,monospace;font-size:16px;font-weight:bold;color:${BRAND.ink};">${escapeHtml(record.trackingNumber)}</p>
          <p style="margin:0 0 4px 0;font-size:13px;color:${BRAND.success};">Transportadora</p>
          <p style="margin:0;font-size:15px;color:${BRAND.ink};">${escapeHtml(record.carrierName) || "-"}</p>
        </td></tr>
      </table>
      ${
        record.labelUrl
          ? `<p style="margin:16px 0 0 0;text-align:center;"><a href="${escapeHtml(record.labelUrl)}" style="display:inline-block;background-color:${BRAND.solid};color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;border-radius:999px;padding:11px 24px;">Ver etiqueta</a></p>`
          : ""
      }
    `,
  });
}

// Colombia no tiene horario de verano — Bogotá es siempre UTC-5. Restar 5h
// a la hora UTC actual y leer los campos UTC del resultado da la hora de
// pared en Bogotá, sin depender de la zona horaria del servidor (Vercel
// corre en UTC, pero esto funciona igual en cualquier entorno).
function getBogotaHour() {
  const bogotaNow = new Date(Date.now() - 5 * 60 * 60 * 1000);
  return bogotaNow.getUTCHours();
}

function deadlineWarningHtml() {
  const beforeDeadline = getBogotaHour() < 16;
  return beforeDeadline
    ? `<p style="margin:0 0 20px 0;padding:12px 14px;background-color:${BRAND.warningBg};border-radius:8px;font-size:14px;font-weight:bold;color:${BRAND.warning};">⚠️ Debes entregar el cuadro en la transportadora HOY antes de las 4:00 PM.</p>`
    : `<p style="margin:0 0 20px 0;padding:12px 14px;background-color:${BRAND.warningBg};border-radius:8px;font-size:14px;font-weight:bold;color:${BRAND.warning};">🕐 Ya pasó el horario de hoy — vuelve mañana más temprano y genera la guía antes de las 4:00 PM para evitar que venza.</p>`;
}

function confirmPage({ ref, token, record }) {
  return renderPage({
    title: "Generar guía — Mystery",
    bodyHtml: `
      <p style="margin:0 0 6px 0;font-size:16px;font-weight:bold;color:${BRAND.ink};">${escapeHtml(record.customer.fullName)}</p>
      <p style="margin:0 0 20px 0;font-size:14px;color:${BRAND.muted};">${escapeHtml(record.order.sizeLabel)} · ${escapeHtml(record.customer.city)}</p>
      ${deadlineWarningHtml()}
      <p style="margin:0 0 20px 0;font-size:14px;line-height:20px;color:${BRAND.ink};">
        Toca el botón SOLO si ya tienes el cuadro listo para entregar en la transportadora.
      </p>
      <form method="POST" action="/api/generate-shipment">
        <input type="hidden" name="ref" value="${escapeHtml(ref)}">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <button type="submit" style="display:block;width:100%;background-color:${BRAND.solid};color:#ffffff;font-size:15px;font-weight:bold;border:none;border-radius:999px;padding:14px 0;cursor:pointer;">✅ Ya fabriqué el cuadro - generar guía</button>
      </form>
    `,
  });
}

function resultPage({ ok, trackingNumber, carrierName, labelUrl, errorMessage }) {
  if (ok) {
    return renderPage({
      title: "Guía generada — Mystery",
      bodyHtml: `
        <p style="margin:0 0 16px 0;font-size:16px;font-weight:bold;color:${BRAND.ink};">✅ Guía generada exitosamente.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.successBg};border-radius:8px;">
          <tr><td style="padding:14px 16px;">
            <p style="margin:0 0 4px 0;font-size:13px;color:${BRAND.success};">Número de guía</p>
            <p style="margin:0 0 10px 0;font-family:'Courier New',Courier,monospace;font-size:16px;font-weight:bold;color:${BRAND.ink};">${escapeHtml(trackingNumber)}</p>
            <p style="margin:0 0 4px 0;font-size:13px;color:${BRAND.success};">Transportadora</p>
            <p style="margin:0;font-size:15px;color:${BRAND.ink};">${escapeHtml(carrierName) || "-"}</p>
          </td></tr>
        </table>
        ${
          labelUrl
            ? `<p style="margin:16px 0 0 0;text-align:center;"><a href="${escapeHtml(labelUrl)}" style="display:inline-block;background-color:${BRAND.solid};color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;border-radius:999px;padding:11px 24px;">Ver etiqueta</a></p>`
            : ""
        }
        <p style="margin:16px 0 0 0;font-size:11px;color:${BRAND.muted};opacity:0.75;">El cliente recibirá el correo de "va en camino" en 2 horas.</p>
      `,
    });
  }
  return renderPage({
    title: "No se pudo generar la guía — Mystery",
    bodyHtml: `
      <p style="margin:0 0 12px 0;font-size:16px;font-weight:bold;color:${BRAND.warning};">⚠️ No se pudo generar la guía.</p>
      <p style="margin:0 0 20px 0;font-size:14px;color:${BRAND.ink};">Motivo: ${escapeHtml(errorMessage)}</p>
      <p style="margin:0;font-size:13px;color:${BRAND.muted};">Puedes volver a intentarlo desde el mismo link del correo.</p>
    `,
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref");
  const token = searchParams.get("token");

  if (!isValidManualShipmentToken(ref, token)) {
    return invalidLinkPage();
  }

  const record = await getManualShipmentRequest(ref);
  if (!record) {
    return notFoundPage();
  }

  if (record.status === "generated" && record.trackingNumber) {
    return alreadyGeneratedPage(record);
  }

  return confirmPage({ ref, token, record });
}

export async function POST(request) {
  const formData = await request.formData();
  const ref = formData.get("ref");
  const token = formData.get("token");

  if (!isValidManualShipmentToken(ref, token)) {
    return invalidLinkPage();
  }

  const record = await getManualShipmentRequest(ref);
  if (!record) {
    return notFoundPage();
  }

  // Idempotencia: si ya se generó (ej. doble click, o el GET de arriba se
  // volvió a confirmar en otra pestaña mientras tanto), no se vuelve a
  // llamar a Skydropx — evita cobrar una segunda guía para el mismo
  // pedido.
  if (record.status === "generated" && record.trackingNumber) {
    return alreadyGeneratedPage(record);
  }

  try {
    const shipment = await createManualShipment({
      order: record.order,
      customer: record.customer,
      reference: ref,
      isCod: record.paymentMethod === "cod",
    });

    if (!shipment.trackingNumber) {
      throw new Error("Skydropx no devolvió un número de guía tras reintentar.");
    }

    await markManualShipmentGenerated(ref, {
      shipmentId: shipment.shipmentId,
      trackingNumber: shipment.trackingNumber,
      carrierName: shipment.carrierName,
      labelUrl: shipment.labelUrl,
      trackingUrl: shipment.trackingUrl,
    });

    // Solo ACÁ se registra la deuda real al fabricante (Redis, ver
    // manufacturerFinance.js) — justo después de confirmar que Skydropx
    // devolvió un trackingNumber real, única evidencia verificable de que
    // el cuadro se fabricó y se entregó a la transportadora. Nunca lanza:
    // un fallo acá no debe tumbar la página de éxito, la guía ya se
    // generó y se guardó igual.
    await recordManufacturerOrder({
      reference: ref,
      order: record.order,
      customer: record.customer,
      guideUrl: shipment.labelUrl,
      shipmentId: shipment.shipmentId,
      trackingNumber: shipment.trackingNumber,
      carrierName: shipment.carrierName,
    });

    // Correo al cliente programado 2 horas después — no debe tumbar la
    // página de éxito si falla, así que se captura aparte y solo se
    // loguea (la guía ya se generó y se guardó igual).
    try {
      const scheduledEmailId = await sendShippingNotificationEmail({
        customer: record.customer,
        trackingNumber: shipment.trackingNumber,
        carrierName: shipment.carrierName,
        trackingUrl: shipment.trackingUrl,
        labelUrl: shipment.labelUrl,
        saldoPendiente: record.saldoPendiente,
        scheduledAt: "in 2 hours",
      });
      // Se guarda para poder cancelar este correo si el fabricante
      // cancela la guía antes de que pasen las 2 horas (ver
      // app/api/fabricante-cancel-shipment/route.js).
      await saveScheduledEmailId(ref, scheduledEmailId);
    } catch (emailErr) {
      console.error("[generate-shipment] Falló el correo de guía generada:", emailErr);
    }

    return resultPage({
      ok: true,
      trackingNumber: shipment.trackingNumber,
      carrierName: shipment.carrierName,
      labelUrl: shipment.labelUrl,
    });
  } catch (err) {
    console.error("[generate-shipment] Falló la creación de guía en Skydropx:", err);
    return resultPage({ ok: false, errorMessage: err.message || String(err) });
  }
}
