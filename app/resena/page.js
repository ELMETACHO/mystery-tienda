import { isValidReviewToken } from "../lib/reviewToken";
import { getCompletedOrderByReference } from "../lib/completedOrders";
import ReviewForm from "./ReviewForm";

export const dynamic = "force-dynamic";

function ErrorState({ message }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <p className="text-lg font-semibold text-zinc-100">{message}</p>
      <p className="text-sm text-zinc-500">
        Si crees que esto es un error, escríbenos y te ayudamos.
      </p>
    </div>
  );
}

export default async function ResenaPage({ searchParams }) {
  const { ref, token } = await searchParams;

  if (!ref || !token || !isValidReviewToken(ref, token)) {
    return <ErrorState message="Este link no es válido o ya venció." />;
  }

  const order = await getCompletedOrderByReference(ref);

  if (!order) {
    return <ErrorState message="No encontramos el pedido asociado a este link." />;
  }

  if (order.reviewSubmittedAt) {
    return <ErrorState message="Ya enviaste tu reseña para este pedido — ¡gracias!" />;
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">¿Qué te pareció tu cuadro?</h1>
        {order.sizeLabel && (
          <p className="mt-1 text-sm text-zinc-400">Pedido: {order.sizeLabel}</p>
        )}
      </div>

      <ReviewForm reference={ref} token={token} />
    </div>
  );
}
