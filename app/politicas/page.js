import Link from "next/link";
import { LEGAL_SECTIONS } from "@/app/lib/legalContent";

export const metadata = {
  title: "Políticas — Mystery",
  description:
    "Política de privacidad, devoluciones y garantías de Mystery, cuadros personalizados en vinilo sobre madera.",
};

export default function PoliticasPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-16 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(168,85,247,0.35), transparent 60%), radial-gradient(circle at 80% 80%, rgba(192,132,252,0.25), transparent 55%)",
        }}
      />

      <div className="relative mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm text-zinc-500 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          ← Volver al inicio
        </Link>

        <div className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent-soft">Mystery</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Políticas
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Todo lo que debes saber sobre privacidad, devoluciones y quiénes hacemos Mystery.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          {LEGAL_SECTIONS.map((section) => (
            <section
              key={section.key}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_40px_-14px_rgba(168,85,247,0.3)] sm:p-6"
            >
              <h2 className="text-base font-semibold text-white sm:text-lg">{section.label}</h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{section.text}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
