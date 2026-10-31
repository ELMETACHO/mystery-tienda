import { Suspense } from "react";
import GiftCardThanks from "./GiftCardThanks";

export const metadata = {
  title: "Tarjeta regalo — Mystery Cuadros",
  robots: { index: false, follow: false },
};

// Sin feature flag a propósito: una compra ya pagada siempre debe poder
// confirmarse aunque se apague la función.
export default function GraciasPage() {
  return (
    <div className="tienda mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
      <Suspense fallback={null}>
        <GiftCardThanks />
      </Suspense>
    </div>
  );
}
