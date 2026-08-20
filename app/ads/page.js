import Image from "next/image";
import Link from "next/link";

// Landing exclusiva para tráfico pagado de TikTok — un solo scroll, sin
// navbar/footer completo, sin nada que distraiga del CTA. No comparte
// layout con el Home (ver app/page.js): vive sola, un solo objetivo.
export const metadata = {
  title: "Mystery — Tu foto favorita, en un cuadro real",
  description: "Sube tu foto y recíbela en cuadro de vinilo sobre madera en tu casa.",
};

// viewport-fit=cover habilita env(safe-area-inset-bottom) para que el botón
// sticky respete el home indicator de iPhone sin quedar tapado ni flotando.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const EJEMPLOS = [
  { src: "/images/page-ads/mystery-mockup-1786943551418.png", alt: "Cuadro personalizado: astronauta con foto propia" },
  { src: "/images/page-ads/mystery-mockup-1787188764534.png", alt: "Cuadro personalizado con foto propia, estilo poster" },
  { src: "/images/page-ads/mystery-mockup-1787188645407.png", alt: "Cuadro personalizado con foto propia, estilo collage" },
];

const PASOS = ["Sube tu foto", "Elige el tamaño", "Recíbelo en casa"];

export default function AdsLanding() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="flex-1 pb-28">
        {/* HERO — se entiende sin leer nada más que el título. */}
        <section className="relative overflow-hidden px-4 pt-10 pb-8 text-center">
          <div
            className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full opacity-20 blur-3xl"
            style={{ background: "var(--accent)" }}
          />
          <div className="relative z-10 mx-auto flex max-w-md flex-col items-center gap-4">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Tu foto favorita, en un cuadro real
            </h1>
            <p className="text-sm text-zinc-400">
              Vinilo sobre madera. Impreso y enviado a tu casa.
            </p>
            <div className="relative mt-2 aspect-[4/5] w-full max-w-xs overflow-hidden rounded-2xl border border-white/10 shadow-lg shadow-accent/20">
              <Image
                src="/images/page-ads/mystery-mockup-1786943551418.png"
                alt="Cuadro personalizado Mystery ya entregado, foto propia impresa en vinilo sobre madera"
                fill
                priority
                sizes="(min-width: 640px) 384px, 90vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* PRUEBA SOCIAL — breve, sin adornos. */}
        <section className="px-4 pb-8">
          <div className="mx-auto flex max-w-md items-center justify-center gap-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center">
            <div>
              <p className="text-xl font-black text-accent-soft">+1.000</p>
              <p className="text-xs text-zinc-400">cuadros entregados</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-xl font-black text-accent-soft">+5 años</p>
              <p className="text-xs text-zinc-400">de experiencia</p>
            </div>
          </div>
        </section>

        {/* EJEMPLOS REALES DEL CATÁLOGO */}
        <section className="px-4 pb-8">
          <div className="mx-auto max-w-md">
            <h2 className="mb-3 text-center text-sm font-semibold text-zinc-300">
              Así se ven en la pared
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {EJEMPLOS.map((ej) => (
                <div
                  key={ej.src}
                  className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/10"
                >
                  <Image
                    src={ej.src}
                    alt={ej.alt}
                    fill
                    sizes="33vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA — 3 pasos, sin íconos SVG pesados. */}
        <section className="px-4 pb-8">
          <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 px-5 py-6">
            <h2 className="mb-4 text-center text-sm font-semibold text-zinc-300">
              Cómo funciona
            </h2>
            <ol className="flex flex-col gap-3">
              {PASOS.map((paso, i) => (
                <li key={paso} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent-soft">
                    {i + 1}
                  </span>
                  <span className="text-sm text-zinc-200">{paso}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* URGENCIA / OFERTA */}
        <section className="px-4 pb-8">
          <div className="mx-auto max-w-md rounded-2xl border border-accent/30 bg-accent/10 px-5 py-4 text-center">
            <p className="text-sm font-semibold text-accent-soft">
              🚚 Envío gratis por tiempo limitado a todo el país
            </p>
          </div>
        </section>

        {/* BLOQUE DE CONFIANZA — discreto, exigido por políticas de anuncios
            de ecommerce de TikTok (contacto + garantía/devoluciones
            visibles). Mismo contenido de garantía que el FAQ del Home. */}
        <section className="px-4">
          <div className="mx-auto max-w-md border-t border-white/10 pt-5 text-center">
            <p className="text-xs text-zinc-500">
              Garantía ante daños de fábrica o de transporte. Escríbenos y lo
              solucionamos.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Contacto:{" "}
              <a href="mailto:pedidos@elmetacho.com" className="underline underline-offset-2">
                pedidos@elmetacho.com
              </a>
            </p>
            <p className="mt-3 text-[11px] text-zinc-600">
              © {new Date().getFullYear()} Mystery. Todos los derechos reservados.
            </p>
          </div>
        </section>
      </main>

      {/* CTA FIJO — siempre visible mientras se hace scroll, en cualquier
          navegador móvil. position: fixed (no sticky) anclado a inset-x-0
          bottom-0 es lo único que se comporta igual en Safari iOS y Chrome
          Android durante el scroll; sticky en un contenedor con overflow
          puede "despegarse" en Safari. Padding con env(safe-area-inset-bottom)
          para no quedar tapado por el home indicator de iPhone. */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-background/95 px-4 pt-3 backdrop-blur-md"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <Link
          href="/crear"
          className="flex w-full items-center justify-center rounded-full bg-accent px-6 py-4 text-base font-bold text-white shadow-lg shadow-accent/30 active:bg-accent-soft"
        >
          Comprar ahora
        </Link>
      </div>
    </div>
  );
}
