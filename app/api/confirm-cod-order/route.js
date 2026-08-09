import { fetchWompiTransaction } from "../../lib/wompi";
import { sendOrderEmails } from "../../lib/email";
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
// La integración con Skydropx para generar la guía automáticamente está
// en pausa esperando confirmación de su soporte sobre si la cuenta
// soporta envíos domésticos Colombia→Colombia con contraentrega (ver
// app/lib/skydropx.js). Mientras tanto, SKYDROPX_COD_ENABLED queda en
// false: el pedido se confirma igual, sin guía automática, y el correo al
// fabricante avisa que hay que crearla manualmente. Cuando soporte
// confirme que la integración aplica, se vuelve a habilitar acá.
const SKYDROPX_COD_ENABLED = false;

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
    } catch (err) {
      // No relanzamos: el pedido contraentrega sigue su curso sin guía
      // automática. Se loguea completo para poder diagnosticar.
      console.error("[confirm-cod-order] Falló la creación de guía en Skydropx:", err);
    }
  }

  const isReturningCustomer = await recordOrderAndCheckReturning({
    email: customer.email,
    reference: transaction.reference,
    amountCOP: order.priceCOP,
    trackingNumber,
    carrierName,
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
