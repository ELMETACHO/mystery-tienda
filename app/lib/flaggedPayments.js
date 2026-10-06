import { after } from "next/server";
import { savePaidOrderBackup } from "./paidBackup";
import { sendPaymentIntegrityAlertEmail } from "./email";

// Qué se hace con un pago aprobado que no pasó checkFull/CodPaymentIntegrity
// (ver paymentIntegrity.js): NO se fabrica ni se genera guía, pero el
// pedido se respalda (para poder procesarlo a mano desde /admin si fue un
// falso positivo) y se avisa a contacto@ por correo.
//
// Síncrono y sin I/O en el camino de la respuesta: el log sale de
// inmediato y el respaldo + correo corren con after() (después de
// responder, mismo patrón que savePaidOrderBackup en el flujo normal), así
// que nunca suma latencia. Nunca lanza. La transacción ya quedó reclamada
// en idempotency.js, así que reintentos del webhook/cron no la vuelven a
// procesar ni duplican la alerta.
export function flagSuspiciousPayment({ order, customer, transaction, paymentMethod, integrity }) {
  console.error(
    `[paymentIntegrity] Pago APROBADO que no coincide con el pedido — NO se procesa. reference=${transaction?.reference} transactionId=${transaction?.id} method=${paymentMethod} problemas=${JSON.stringify(integrity?.problems)}`
  );

  after(async () => {
    await savePaidOrderBackup({
      reference: transaction?.reference,
      order,
      customer,
      paymentMethod,
      transactionId: transaction?.id,
    });

    try {
      await sendPaymentIntegrityAlertEmail({
        reference: transaction?.reference,
        transactionId: transaction?.id,
        paymentMethod,
        problems: integrity?.problems,
        order,
        customer,
        paidCOP: integrity?.paidCOP,
        minimumCOP: integrity?.minimumCOP,
      });
    } catch (err) {
      console.error("[paymentIntegrity] No se pudo enviar la alerta por correo:", err);
    }
  });
}
