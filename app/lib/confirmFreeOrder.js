import { after } from "next/server";
import { sendOrderEmails } from "./email";
import { recordOrderAndCheckReturning } from "./loyalty";
import { processCatalogProductPurchase } from "./catalogPurchase";
import { claimTransaction, releaseTransactionClaim } from "./idempotency";
import { saveCompletedOrder } from "./completedOrders";
import { consumeStockForOrder } from "./inventory";
import { saveManualShipmentRequest } from "./manualShipments";
import { grantDiscountCode } from "./discount";
import { redeemGiftCode, releaseGiftCodeUse } from "./giftCodes";
import { recordCrmEntry } from "./manufacturerFinance";
import { withSanitizedAttribution } from "./attributionChannels";

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
  // Origen del cliente (ver attribution.js): se limpia acá, síncrono y en
  // microsegundos, para que todo lo que se guarde abajo ya venga limpio.
  order = withSanitizedAttribution(order);
  const transaction = { id: reference, reference, status: "APPROVED" };

  const claimed = await claimTransaction(transaction.id);
  if (!claimed) {
    return { alreadyProcessed: true, isReturningCustomer: false };
  }

  // El uso del código se consume ANTES de procesar nada y su resultado sí
  // se respeta: antes se validaba en la ruta y se canjeaba al final
  // ignorando el resultado, así que N requests en paralelo con un código de
  // 1 uso (cada una con su propia reference) generaban N cuadros gratis.
  // INCR es atómico, así que solo pasan tantos pedidos como usos tenga.
  if (order.giftCode) {
    const redeemed = await redeemGiftCode(order.giftCode);
    if (!redeemed) {
      await releaseTransactionClaim(transaction.id);
      return { alreadyProcessed: false, isReturningCustomer: false, giftCodeRejected: true };
    }
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

    // (El uso del código de regalo ya se consumió arriba, antes del try.)

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

    // Descuenta del inventario físico — diferido con after() para que jamás
    // demore ni afecte al cliente (idempotente, nunca lanza, solo lo ve el admin).
    after(() => consumeStockForOrder({ order, reference: transaction.reference }));

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
    if (order.giftCode) await releaseGiftCodeUse(order.giftCode);
    throw err;
  }
}
