// Solo para uso en el servidor: consulta el estado real de una transacción en Wompi
// usando la llave privada, en lugar de confiar en el resultado que reporta el navegador.

const WOMPI_API_BASE = process.env.WOMPI_PRIVATE_KEY?.startsWith("prv_test_")
  ? "https://sandbox.wompi.co/v1"
  : "https://production.wompi.co/v1";

export async function fetchWompiTransaction(transactionId) {
  const res = await fetch(`${WOMPI_API_BASE}/transactions/${transactionId}`, {
    headers: {
      Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Wompi respondió ${res.status} al consultar la transacción`);
  }

  const { data } = await res.json();
  return data;
}

// Todas las transacciones de Wompi asociadas a una `reference` (un mismo
// pedido puede tener varios intentos: declinado y luego aprobado). Usado
// por el cron de conciliación para detectar pagos aprobados que nunca se
// confirmaron (ver app/api/cron/send-cart-recovery-emails).
export async function fetchWompiTransactionsByReference(reference) {
  const res = await fetch(
    `${WOMPI_API_BASE}/transactions?reference=${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(`Wompi respondió ${res.status} al buscar la referencia ${reference}`);
  }

  const { data } = await res.json();
  return Array.isArray(data) ? data : [];
}
