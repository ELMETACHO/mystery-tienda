import Link from "next/link";
import { LEGAL_SECTIONS } from "@/app/lib/legalContent";

export const metadata = {
  title: "Políticas — Mystery",
  description:
    "Política de privacidad, devoluciones y garantías de Mystery, cuadros personalizados en vinilo sobre madera.",
};

export default function PoliticasPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#8fcaf0] px-4 py-16 text-[#1b2a4a] sm:px-6">
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/walls/fondo-cielo-2.webp)" }}
      />

      <div className="relative z-10 mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm text-[#5b6b8c] underline-offset-4 transition-colors hover:text-[#1b2a4a] hover:underline"
        >
          ← Volver al inicio
        </Link>

        <div className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Mystery</p>
          <h1 className="font-heading mt-2 text-2xl font-bold tracking-tight text-[#1b2a4a] sm:text-3xl">
            Políticas
          </h1>
          <p className="mt-2 text-sm text-[#5b6b8c]">
            Todo lo que debes saber sobre privacidad, devoluciones y quiénes hacemos Mystery.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          {LEGAL_SECTIONS.map((section) => (
            <section
              key={section.key}
              className="rounded-2xl border border-black/5 bg-[#fffaf0] p-5 shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)] sm:p-6"
            >
              <h2 className="font-heading text-base font-semibold text-[#1b2a4a] sm:text-lg">{section.label}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#33456b]">{section.text}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
