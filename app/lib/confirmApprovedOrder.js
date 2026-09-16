import { after } from "next/server";
import { sendOrderEmails } from "./email";
import { recordOrderAndCheckReturning } from "./loyalty";
import { processCatalogProductPurchase } from "./catalogPurchase";
import { upscaleImageDataUrl } from "./upscaleImage";
import { claimTransaction, releaseTransactionClaim } from "./idempotency";
import { saveCompletedOrder } from "./completedOrders";
import { saveManualShipmentRequest } from "./manualShipments";
import { grantDiscountCode, markDiscountUsed } from "./discount";
import { recordReferralSale } from "./referrals";
import { recordCrmEntry } from "./manufacturerFinance";

// Lógica de confirmación de un pago YA VERIFICADO como APPROVED contra
// Wompi — compartida entre /api/confirm-order (cuando el cliente
// regresa a la pestaña) y /api/wompi-webhook (server-to-server,
// funciona incluso si el cliente nunca vuelve). Ambos caminos pueden
// llegar a confirmar la MISMA transacción, así que esto empieza
// reclamando un lock de idempotencia (ver idempotency.js) — quien
// llegue primero hace el trabajo, el segundo no hace nada.
//
// Si algo falla DESPUÉS de reclamar el lock (ej. el envío de correos),
// se libera el reclamo antes de relanzar el error — así un reintento
// legítimo (el propio webhook de Wompi reintenta hasta 3 veces en 24h)
// puede volver a intentarlo, en vez de quedar marcado como "ya
// procesado" sin que en realidad se haya completado.
export async function confirmApprovedOrder({ order, customer, transaction }) {
  const claimed = await claimTransaction(transaction.id);
  if (!claimed) {
    return { alreadyProcessed: true, isReturningCustomer: false };
  }

  try {
    // Historial de pedidos por correo en KV: se registra el pedido
    // actual y se detecta si el cliente ya tenía uno previo, ANTES de
    // enviar el correo de confirmación.
    const isReturningCustomer = await recordOrderAndCheckReturning({
      email: customer.email,
      reference: transaction.reference,
      amountCOP: order.priceCOP,
    });

    // Otorga el código MYSTERY10 la primera vez que detectamos que es
    // cliente recurrente — grantDiscountCode no hace nada si ya tenía
    // uno guardado (usado o no), así que es seguro llamarlo en cada
    // compra recurrente sin re-otorgar ni resetear uno ya canjeado.
    if (isReturningCustomer) {
      await grantDiscountCode(customer.email);
    }

    // Si este pedido usó un código de descuento, lo marcamos como usado
    // recién ahora que el pago quedó aprobado — nunca antes de este
    // punto. Se revalida code/used server-side (ver markDiscountUsed),
    // así que es seguro aunque order.discountCode venga manipulado desde
    // el navegador: si no coincide con el registro real, simplemente no
    // se marca nada.
    if (order.discountCode) {
      await markDiscountUsed(customer.email, order.discountCode);
    }

    // Si este pedido trae un código de referido, acredita la comisión
    // según el tamaño comprado — nunca bloquea la confirmación si el
    // código no existe o Redis falla (ver recordReferralSale).
    if (order.referralCode) {
      await recordReferralSale({ code: order.referralCode, sizeId: order.sizeId });
    }

    // Igual que en el pedido contraentrega (ver
    // app/api/confirm-cod-order/route.js): la guía de Skydropx no se
    // genera automáticamente acá — se guarda la solicitud para que el
    // fabricante la dispare desde el botón de su correo cuando el cuadro
    // esté listo (sin monto a recaudar, ver saldoPendiente: 0 — este
    // pedido ya está pagado completo).
    await saveManualShipmentRequest({
      reference: transaction.reference,
      order,
      customer,
      paymentMethod: "wompi",
      saldoPendiente: 0,
    });

    // Registro CRM (ver manufacturerFinance.js) — solo datos de
    // contacto/compra, independiente de si el cuadro se llega a
    // fabricar y despachar. La DEUDA al fabricante (Sheets + Redis) ya
    // NO se registra acá: se mueve al momento en que se genera la guía
    // real de Skydropx (ver app/api/generate-shipment/route.js), única
    // evidencia verificable de que el cuadro se fabricó y se entregó a
    // la transportadora — así pedidos de prueba, cancelados o nunca
    // fabricados nunca generan una deuda fantasma. Nunca lanza.
    await recordCrmEntry({ order, customer, paymentMethod: "wompi" });

    // Si el pedido viene de /producto/[id] (catálogo), incrementa el
    // contador de ventas de ese producto y trae el archivo real de
    // impresión desde Drive para adjuntarlo — no hace nada para
    // pedidos normales de /crear (sin order.productId).
    const { printImageBase64 } = await processCatalogProductPurchase(order);

    // El upscale (Replicate, hasta ~55s en el peor caso, ver
    // upscaleImage.js) y el envío de correos se difieren con after() —
    // el cliente ya tiene su pago verificado y su pedido registrado en
    // este punto (CRM, guía manual, etc. arriba), así que no tiene por
    // qué esperar en su checkout a que termine todo esto. after() corre
    // DESPUÉS de que la respuesta ya salió al navegador — Vercel
    // mantiene viva la función el tiempo que haga falta (waitUntil),
    // sin bloquear la pantalla de confirmación del cliente.
    //
    // Un fallo acá adentro (Replicate caído, Resend caído) ya NO libera
    // el reclamo de idempotencia ni relanza el error — a propósito: el
    // pago y el registro del pedido ya están confirmados y no deben
    // reintentarse solo porque el correo falló (eso duplicaría comisión
    // de referido, descuento otorgado, etc.). Solo queda logueado en
    // Vercel para revisar a mano si pasa.
    after(async () => {
      try {
        const orderForEmail = printImageBase64
          ? order
          : { ...order, printImage: await upscaleImageDataUrl(order.printImage) };

        await sendOrderEmails({
          order: orderForEmail,
          customer,
          transaction,
          isReturningCustomer,
          printImageBase64Override: printImageBase64,
        });

        await saveCompletedOrder({ order, customer, transaction, paymentMethod: "wompi" });
      } catch (err) {
        console.error(
          "[confirmApprovedOrder] Falló el trabajo diferido (upscale/correos/registro):",
          err
        );
      }
    });

    return { alreadyProcessed: false, isReturningCustomer };
  } catch (err) {
    await releaseTransactionClaim(transaction.id);
    throw err;
  }
}
