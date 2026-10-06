import { notFound } from "next/navigation";
import { GIFT_FEATURES_ENABLED, giftCardPriceCOP } from "../lib/giftFeatures";
import { formatCOP } from "../lib/order";
import GiftCardForm from "./GiftCardForm";

// Tarjeta regalo digital (apagada por defecto: NEXT_PUBLIC_GIFT_FEATURES=1).
// Página propia, fuera de /checkout y /crear: no les suma nada.
export const metadata = {
  title: "Tarjeta regalo — Mystery Cuadros",
  description: "Regala un cuadro 40x50 con la foto que quiera. Envío gratis a toda Colombia.",
  robots: { index: false, follow: true },
};

export default function TarjetaRegaloPage() {
  if (!GIFT_FEATURES_ENABLED) notFound();
  return (
    <div className="tienda mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">Tarjeta regalo</h1>
        <p className="mt-2 text-sm text-[#33456b]">
          Vale por <strong>un cuadro 40x50</strong> con la foto que la persona elija, envío gratis a toda Colombia.
          Te llega al correo para reenviarla o imprimirla.
        </p>
        <p className="mt-3 text-2xl font-bold text-accent">{formatCOP(giftCardPriceCOP())}</p>
      </div>
      <GiftCardForm />
    </div>
  );
}
