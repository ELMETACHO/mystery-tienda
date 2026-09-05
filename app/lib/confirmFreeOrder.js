import { sendOrderEmails } from "./email";
import { recordOrderAndCheckReturning } from "./loyalty";
import { processCatalogProductPurchase } from "./catalogPurchase";
import { claimTransaction, releaseTransactionClaim } from "./idempotency";
import { saveCompletedOrder } from "./completedOrders";
import { saveManualShipmentRequest } from "./manualShipments";
import { grantDiscountCode } from "./discount";
import { redeemGiftCode } from "./giftCodes";
import { recordCrmEntry } from "./manufacturerFinance";

// Equivalente de confirmApprovedOrder.js para pedidos con precio final
// $0 (código de regalo, ver app/lib/giftCodes.js): NUNCA pasan por
// Wompi (no tiene sentido cobrar $0 por una pasarela de pago), así que
// no hay `transaction` real que verificar — se sintetiza una con el
// mismo `reference` que genera /api/confirm-free-order, y esa reference
// también sirve como id de idempotencia (claimTransaction no necesita
// que sea un id de Wompi real, ver idempotency.js).
//
// /api/confirm-free-order ya revalidó el código de regalo y el tamaño
// 40x50 ANTES de llamar acá — esta función confía en que order.giftCode
// y order.priceCOP ya son válidos, igual que confirmApprovedOrder.js
// confía en que `transaction.status === "APPROVED"` ya viene verificado
// por su propio llamador.
export async function confirmFreeOrder({
  order,
  customer,
  reference,
  // Solo para scripts/pruebas puntuales (mismo patrón que sendOrderEmails
  // en email.js) — nunca se usan en el flujo real de /checkout.
  subjectPrefix,
  testRecipientOverride,
}) {
  const transaction = { id: reference, reference, status: "APPROVED" };

  const claimed = await claimTransaction(transaction.id);
  if (!claimed) {
    return { alreadyProcessed: true, isReturningCustomer: false };
  }

  try {
    const isReturningCustomer = await recordOrderAndCheckReturning({
      email: customer.email,
      reference: transaction.reference,
      amountCOP: order.priceCOP,
    });

    if (isReturningCustomer) {
      await grantDiscountCode(customer.email);
    }

    // Consume uno de los usos del código de regalo — nunca lanza ni
    // bloquea la confirmación si falla (mismo criterio que
    // markDiscountUsed/recordReferralSale): el pedido de regalo ya se
    // está entregando, perder el conteo de usos por un fallo de Redis
    // no debe impedir que el influencer reciba su cuadro.
    if (order.giftCode) {
      await redeemGiftCode(order.giftCode);
    }

    // Mismo flujo de guía manual que un pedido pagado completo (ver
    // confirmApprovedOrder.js) — el fabricante la dispara desde su
    // correo cuando el cuadro esté listo, sin monto a recaudar.
    await saveManualShipmentRequest({
      reference: transaction.reference,
      order,
      customer,
      paymentMethod: "regalo",
      saldoPendiente: 0,
    });

    await recordCrmEntry({ order, customer, paymentMethod: "regalo" });

    const { printImageBase64 } = await processCatalogProductPurchase(order);

    await sendOrderEmails({
      order,
      customer,
      transaction,
      isReturningCustomer,
      paymentMethod: "regalo",
      printImageBase64Override: printImageBase64,
      subjectPrefix,
      testRecipientOverride,
    });

    await saveCompletedOrder({ order, customer, transaction, paymentMethod: "regalo" });

    return { alreadyProcessed: false, isReturningCustomer };
  } catch (err) {
    await releaseTransactionClaim(transaction.id);
    throw err;
  }
}
