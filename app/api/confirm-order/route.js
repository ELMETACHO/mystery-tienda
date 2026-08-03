import { fetchWompiTransaction } from "../../lib/wompi";
import { sendOrderEmails } from "../../lib/email";
import { recordOrderAndCheckReturning } from "../../lib/loyalty";

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
      { error: "No se pudo verificar el pago con Wompi" },
      { status: 502 }
    );
  }

  if (transaction.status !== "APPROVED") {
    return Response.json(
      { error: "El pago no está aprobado", status: transaction.status },
      { status: 402 }
    );
  }

  // Historial de pedidos por correo en KV: se registra el pedido actual y
  // se detecta si el cliente ya tenía uno previo, ANTES de enviar el
  // correo de confirmación (para poder usarlo en el resultado devuelto y,
  // más adelante si aplica, en el propio contenido del correo).
  const isReturningCustomer = await recordOrderAndCheckReturning({
    email: customer.email,
    reference: transaction.reference,
    amountCOP: order.priceCOP,
  });

  try {
    await sendOrderEmails({ order, customer, transaction, isReturningCustomer });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: "El pago fue aprobado pero falló el envío de correos" },
      { status: 500 }
    );
  }

  return Response.json({
    verified: true,
    reference: transaction.reference,
    status: transaction.status,
    isReturningCustomer,
  });
}
