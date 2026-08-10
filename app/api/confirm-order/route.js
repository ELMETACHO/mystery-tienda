import { fetchWompiTransaction } from "../../lib/wompi";
import { confirmApprovedOrder } from "../../lib/confirmApprovedOrder";

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

  // confirmApprovedOrder es idempotente: si el webhook (/api/wompi-webhook)
  // ya confirmó esta misma transacción antes de que el cliente regresara
  // a esta pestaña, acá simplemente no se repite el trabajo (ni los
  // correos) — isReturningCustomer se devuelve en false como valor
  // seguro en ese caso, ya que no se vuelve a calcular.
  let isReturningCustomer;
  try {
    ({ isReturningCustomer } = await confirmApprovedOrder({ order, customer, transaction }));
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
