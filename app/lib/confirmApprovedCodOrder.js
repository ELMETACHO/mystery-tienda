import { sendOrderEmails } from "./email";
import { recordOrderAndCheckReturning } from "./loyalty";
import { processCatalogProductPurchase } from "./catalogPurchase";
import { claimTransaction, releaseTransactionClaim } from "./idempotency";
import { saveCompletedOrder } from "./completedOrders";
import { saveManualShipmentRequest } from "./manualShipments";
import { grantDiscountCode, markDiscountUsed } from "./discount";
import { recordReferralSale } from "./referrals";
import { recordCrmEntry } from "./manufacturerFinance";
import { COD_DEPOSIT_COP } from "./order";

// Equivalente de confirmApprovedOrder.js, pero para "Pago contraentrega":
// el cliente pagó solo el anticipo fijo (COD_DEPOSIT_COP) por Wompi, y el
// resto lo paga en efectivo al recibir el cuadro. Compartida entre
// /api/confirm-cod-order (cuando el cliente regresa a la pestaña) y
// /api/wompi-webhook (server-to-server, respaldo si el cliente nunca
// vuelve) — antes de este cambio, el webhook no tenía forma de confirmar
// pedidos contraentrega en absoluto (nunca se guardaba un pending-order
// para ellos), así que un fallo en el navegador perdía el pedido por
// completo pese al cobro real.
//
// Mismo lock de idempotencia que confirmApprovedOrder — necesario ahora
// que existen dos caminos que pueden llegar a confirmar la misma
// transacción de anticipo.
export async function confirmApprovedCodOrder({ order, customer, transaction }) {
  const claimed = await claimTransaction(transaction.id);
  if (!claimed) {
    return { alreadyProcessed: true, isReturningCustomer: false, anticipoPagado: 0, saldoPendiente: 0 };
  }

  const anticipoPagado = COD_DEPOSIT_COP;
  const saldoPendiente = order.priceCOP - COD_DEPOSIT_COP;

  try {
    // Nunca lanza (ver manualShipments.js) — si esto falla, el pedido
    // sigue su curso igual; el único efecto es que el botón del correo
    // del fabricante no podrá generar la guía más adelante.
    await saveManualShipmentRequest({
      reference: transaction.reference,
      order,
      customer,
      paymentMethod: "cod",
      saldoPendiente,
    });

    const isReturningCustomer = await recordOrderAndCheckReturning({
      email: customer.email,
      reference: transaction.reference,
      amountCOP: order.priceCOP,
    });

    if (isReturningCustomer) {
      await grantDiscountCode(customer.email);
    }
    if (order.discountCode) {
      await markDiscountUsed(customer.email, order.discountCode);
    }

    if (order.referralCode) {
      await recordReferralSale({ code: order.referralCode, sizeId: order.sizeId });
    }

    // Nunca lanza.
    await recordCrmEntry({ order, customer, paymentMethod: "cod" });

    const { printImageBase64 } = await processCatalogProductPurchase(order);

    await sendOrderEmails({
      order,
      customer,
      transaction,
      isReturningCustomer,
      paymentMethod: "cod",
      anticipoPagado,
      saldoPendiente,
      printImageBase64Override: printImageBase64,
    });

    // Se guarda DESPUÉS de que los correos de confirmación ya salieron
    // bien, nunca antes — mismo criterio que confirmApprovedOrder.js.
    await saveCompletedOrder({ order, customer, transaction, paymentMethod: "cod" });

    return { alreadyProcessed: false, isReturningCustomer, anticipoPagado, saldoPendiente };
  } catch (err) {
    await releaseTransactionClaim(transaction.id);
    throw err;
  }
}
