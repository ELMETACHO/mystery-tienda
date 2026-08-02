import { fetchWompiTransaction } from "../../lib/wompi";
import { sendOrderEmails } from "../../lib/email";

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

  try {
    await sendOrderEmails({ order, customer, transaction });
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
  });
}
