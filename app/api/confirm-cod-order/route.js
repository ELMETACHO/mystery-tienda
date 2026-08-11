import { fetchWompiTransaction } from "../../lib/wompi";
import { sendOrderEmails, sendShippingNotificationEmail } from "../../lib/email";
import { recordOrderAndCheckReturning } from "../../lib/loyalty";
import { COD_DEPOSIT_COP } from "../../lib/order";
import { createCodShipment } from "../../lib/skydropx";
import { processCatalogProductPurchase } from "../../lib/catalogPurchase";

// Confirma un pedido "Pago contraentrega": el cliente paga un anticipo
// fijo (COD_DEPOSIT_COP) por Wompi para cubrir costos de producción, y el
// saldo restante lo paga en efectivo al recibir el cuadro. A diferencia
// de /api/confirm-order (pago completo), acá SÍ hay una transacción de
// Wompi que verificar, pero solo por el monto del anticipo — nunca se
// confía en el navegador para eso.
//
// Habilitado tras confirmar en vivo (solo cotización, ticket #47432505243)
// que Bogotá/Cali/Medellín/Barranquilla y una ciudad aleatoria cotizan
// correctamente contra el catálogo canónico de códigos postales
// (app/lib/postalCodes.js), y tras ampliar COD_CARRIERS para incluir
// Coordinadora/Envía además de Servientrega/Interrapidísimo. Si de todos
// modos falla (sin transportadora COD disponible para esa dirección, o un
// error técnico), el pedido sigue su curso sin guía automática — ver
// manejo del error más abajo y el aviso reforzado en el correo al
// fabricante (app/lib/email.js).
const SKYDROPX_COD_ENABLED = true;

export async function POST(request) {
  const { transactionId, order, customer } = await request.json();

  if (!transactionId || !order || !customer) {
    return Response.json({ error: "Datos incompletos" }, { status: 400 });
  }

  let transaction;
  try {
    transaction = await fetchWompiTransaction(transactionId);
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: "No se pudo verificar el pago del anticipo con Wompi" },
      { status: 502 }
    );
  }

  if (transaction.status !== "APPROVED") {
    return Response.json(
      { error: "El anticipo no está aprobado", status: transaction.status },
      { status: 402 }
    );
  }

  const anticipoPagado = COD_DEPOSIT_COP;
  const saldoPendiente = order.priceCOP - COD_DEPOSIT_COP;

  let trackingNumber = null;
  let carrierName = null;
  // true solo cuando SÍ se intentó generar la guía y falló (por cualquier
  // motivo) — nunca queda en true si SKYDROPX_COD_ENABLED está apagado, para
  // no mostrar la alerta de "gestionar manualmente" cuando la integración
  // simplemente no corrió.
  let shipmentFailed = false;
  // Mensaje de error EXACTO (err.message), no solo el booleano de arriba —
  // se guarda en Redis (ver loyalty.js) y se muestra en el correo al
  // fabricante para poder diagnosticar sin ir a los logs de Vercel. Un caso
  // real: faltaban SKYDROPX_CLIENT_ID/SECRET en las variables de entorno de
  // Vercel (sí estaban en .env.local, pero nunca se agregaron en
  // Vercel → Settings → Environment Variables — ver CLAUDE.md).
  let shipmentError = null;
  if (SKYDROPX_COD_ENABLED) {
    try {
      const shipment = await createCodShipment({
        order,
        customer,
        reference: transaction.reference,
      });
      trackingNumber = shipment.trackingNumber || null;
      carrierName = shipment.carrierName || null;
      console.log(
        "[confirm-cod-order] Guía Skydropx creada:",
        trackingNumber,
        carrierName
      );

      // Correo de "va en camino" al cliente — solo cuando la guía SÍ se
      // generó con éxito (tracking_number y label_url presentes). No debe
      // tumbar la confirmación del pedido si falla, así que se captura
      // aparte y solo se loguea.
      if (trackingNumber && shipment.labelUrl) {
        try {
          await sendShippingNotificationEmail({
            customer,
            trackingNumber,
            carrierName,
            trackingUrl: shipment.trackingUrl,
            labelUrl: shipment.labelUrl,
            saldoPendiente,
          });
        } catch (emailErr) {
          console.error(
            "[confirm-cod-order] Falló el correo de guía generada:",
            emailErr
          );
        }
      }
    } catch (err) {
      // No relanzamos: el pedido contraentrega sigue su curso sin guía
      // automática. Se loguea completo para poder diagnosticar — y además
      // se refleja en el correo al fabricante (banner + asunto), en vez de
      // quedar solo en logs que nadie revisa en el momento.
      shipmentFailed = true;
      shipmentError = err.message || String(err);
      console.error("[confirm-cod-order] Falló la creación de guía en Skydropx:", err);
    }
  }

  const isReturningCustomer = await recordOrderAndCheckReturning({
    email: customer.email,
    reference: transaction.reference,
    amountCOP: order.priceCOP,
    trackingNumber,
    carrierName,
    shipmentError,
  });

  // Si el pedido viene de /producto/[id] (catálogo), incrementa el
  // contador de ventas de ese producto y trae el archivo real de
  // "Original (Portafolio)" desde Drive para adjuntarlo — no hace nada
  // para pedidos normales de /crear (sin order.productId).
  const { printImageBase64 } = await processCatalogProductPurchase(order);

  try {
    await sendOrderEmails({
      order,
      customer,
      transaction,
      isReturningCustomer,
      paymentMethod: "cod",
      trackingNumber,
      carrierName,
      shipmentFailed,
      shipmentError,
      anticipoPagado,
      saldoPendiente,
      printImageBase64Override: printImageBase64,
    });
  } catch (err) {
    console.error("[confirm-cod-order] Falló el envío de correos:", err);
    return Response.json(
      { error: "El anticipo se confirmó pero falló el envío de correos" },
      { status: 500 }
    );
  }

  return Response.json({
    verified: true,
    reference: transaction.reference,
    status: transaction.status,
    isReturningCustomer,
    trackingNumber,
    carrierName,
    anticipoPagado,
    saldoPendiente,
  });
}
