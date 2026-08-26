import Link from "next/link";
import { LEGAL_SECTIONS } from "@/app/lib/legalContent";

export const metadata = {
  title: "Políticas — Mystery",
  description:
    "Política de privacidad, devoluciones y garantías de Mystery, cuadros personalizados en vinilo sobre madera.",
};

export default function PoliticasPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-16 sm:px-6">
      <Link
        href="/"
        className="text-sm text-zinc-500 underline-offset-4 hover:text-white hover:underline"
      >
        ← Volver al inicio
      </Link>

      <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">Políticas de Mystery</h1>

      <div className="mt-10 flex flex-col gap-10">
        {LEGAL_SECTIONS.map((section) => (
          <section key={section.key}>
            <h2 className="text-lg font-semibold text-zinc-100">{section.label}</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{section.text}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
