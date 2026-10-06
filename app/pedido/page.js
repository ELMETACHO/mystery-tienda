import Link from "next/link";
import OrderStatusClient from "./OrderStatusClient";
import { normalizeReference } from "../lib/orderStatus";

// Página de seguimiento: el cliente escribe su número de pedido + celular.
// noindex: no aporta nada en buscadores y no debe aparecer en resultados.
export const metadata = {
  title: "Estado de mi pedido | Mystery Cuadros",
  description: "Consulta el estado de tu cuadro Mystery con tu número de pedido y tu celular.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PedidoPage({ searchParams }) {
  const params = (await searchParams) || {};
  const initialReference = normalizeReference(Array.isArray(params.ref) ? params.ref[0] : params.ref) || "";

  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[#8fcaf0] text-[#1b2a4a]">
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/walls/fondo-cielo-2.webp)" }}
      />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-black/10 bg-[#fffaf0] px-4 py-2 text-sm font-medium text-[#33456b] shadow-sm hover:border-accent"
        >
          ← Volver al inicio
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Estado de mi pedido</h1>
          <p className="mt-1 text-sm text-[#33456b]">
            Escribe tu número de pedido (está en tu correo de confirmación y en la pantalla final del pago) y el celular
            con el que pagaste.
          </p>
        </div>
        <OrderStatusClient initialReference={initialReference} />
      </div>
    </div>
  );
}
