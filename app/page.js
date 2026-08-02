import Link from "next/link";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6">
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--accent)" }}
      />

      <main className="relative z-10 flex max-w-2xl flex-col items-center gap-8 text-center">
        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-sm tracking-wide text-accent-soft">
          Cuadros en vinilo sobre madera
        </span>

        <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
          Mystery
        </h1>

        <p className="max-w-md text-lg text-zinc-400 sm:text-xl">
          Cuadros personalizados, tu foto en la pared.
        </p>

        <Link
          href="/crear"
          className="mt-4 rounded-full bg-accent px-8 py-3 text-base font-medium text-white transition-colors hover:bg-accent-soft"
        >
          Crear mi cuadro
        </Link>
      </main>
    </div>
  );
}
