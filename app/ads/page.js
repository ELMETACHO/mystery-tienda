import Image from "next/image";
import { getRecentProducts } from "../lib/catalog";
import CrearFlow from "../components/CrearFlow";
import ProductScroller from "../components/ProductScroller";
import CountdownBanner from "../components/ads/CountdownBanner";
import ViewersCounter from "../components/ads/ViewersCounter";
import StickyBuyButton from "../components/ads/StickyBuyButton";
import RecentPurchaseToast from "../components/ads/RecentPurchaseToast";
import FooterLegalAccordion from "../components/ads/FooterLegalAccordion";

// Landing exclusiva para tráfico pagado de TikTok — un solo scroll, sin
// navbar/footer completo, sin nada que distraiga del CTA. No comparte
// layout con el Home (ver app/page.js): vive sola, un solo objetivo. El
// flujo de /crear vive embebido acá mismo (ver sección "crear-embed" más
// abajo, y app/components/CrearFlow.jsx) para que comprar no implique salir
// de la página del anuncio.
export const dynamic = "force-dynamic";

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
  { src: "/images/page-ads/PARED1.png", alt: "Cuadro Mystery entregado, colgado en la pared de un cliente" },
  { src: "/images/page-ads/PARED2.png", alt: "Cuadro Mystery entregado, colgado en la pared de un cliente" },
  { src: "/images/page-ads/PARED3.png", alt: "Cuadro Mystery entregado, colgado en la pared de un cliente" },
];

export default async function AdsLanding() {
  const recientes = await getRecentProducts(200);

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-[#8fcaf0] text-[#1b2a4a]">
      {/* Mismo fondo fijo del Home/​/crear: la foto de cielo no se mueve
          con el scroll. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/walls/fondo-cielo-2.webp)" }}
      />

      {/* 1. HEADER FIJO — position:fixed (no sticky, mismo criterio que el
          botón inferior: sticky puede "despegarse" en Safari durante el
          scroll). Solo esta franja, nada más. Se deja negra/roja a
          propósito: es la cinta de urgencia del anuncio, no forma parte
          del "tema" de la página. */}
      <div className="fixed inset-x-0 top-0 z-50 bg-black px-4 py-2.5 text-center">
        <p className="text-xs font-semibold text-red-500 sm:text-sm">
          🚚 Envío gratis a todo el país - Paga al recibir
        </p>
      </div>

      <main className="relative z-10 flex-1 pb-28 pt-11">
        {/* 2. NOMBRE DE MARCA — primer contenido debajo del header fijo. */}
        <div className="px-4 pb-4 pt-5 text-center">
          <p className="font-brand text-2xl tracking-tight text-[#1b2a4a] sm:text-3xl">
            Mystery Cuadros
          </p>
        </div>

        {/* 3. IMAGEN/GIF GRANDE — video en vez de GIF: el archivo original
            (generado en Freepik) pesaba 95MB, inviable para una landing
            optimizada para velocidad. Convertido a MP4 (h264, ~0.9MB) con
            la misma animación. autoPlay + muted + loop + playsInline es la
            combinación que arranca sola y en bucle continuo sin gesto del
            usuario tanto en Safari iOS como en Chrome Android. poster evita
            el flash en blanco mientras carga. */}
        <section className="px-4 pb-5">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-xs overflow-hidden rounded-2xl border border-black/10 shadow-lg shadow-accent/20 sm:max-w-sm">
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster="/images/page-ads/hero-poster.jpg"
              className="h-full w-full object-cover"
              aria-label="Cuadro personalizado Mystery, animación de muestra"
            >
              <source src="/images/page-ads/hero-loop.mp4" type="video/mp4" />
            </video>
          </div>
        </section>

        {/* 4. URGENCIA — cuenta regresiva de 1 hora, por sesión (ver
            CountdownBanner). */}
        <section className="px-4 pb-3">
          <CountdownBanner />
        </section>

        {/* 5. PRUEBA SOCIAL EN VIVO — número pseudo-aleatorio, no un
            conteo real (ver ViewersCounter). */}
        <section className="px-4 pb-6">
          <ViewersCounter />
        </section>

        {/* 6. INFORMACIÓN DEL PRODUCTO */}
        <section className="px-4 pb-6 text-center">
          <h1 className="font-heading text-2xl font-extrabold leading-tight tracking-tight text-[#1b2a4a] sm:text-3xl">
            Cuadro decorativo de excelente calidad en madera y vinilo laminado.
          </h1>
          <p className="mt-2 text-xl font-bold text-accent sm:text-2xl">
            Desde $55.000 COP
          </p>
        </section>

        {/* 7. FLUJO DE /crear EMBEBIDO — mismo componente que usa /crear
            (app/components/CrearFlow.jsx), en modo "compact": misma lógica
            de subida/recorte/tamaño/confirmación, sin la cabecera grande
            que no tiene sentido en medio de esta página. */}
        <section id="crear-embed" className="scroll-mt-12 px-4 pb-8">
          <h2 className="font-heading mb-4 text-center text-xl font-bold tracking-tight sm:text-2xl">
            Tu cuadro con cualquier imagen
          </h2>
          <CrearFlow compact />
        </section>

        {/* 8. TESTIMONIOS — sin reseñas reales todavía, se muestran cuadros
            entregados como ejemplo visual (no citas de texto inventadas). */}
        <section className="px-4 pb-8">
          <h2 className="mb-3 text-center text-sm font-semibold text-[#33456b]">
            Así se ven en la pared
          </h2>
          <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
            {EJEMPLOS.map((ej) => (
              <div
                key={ej.src}
                className="relative aspect-[4/5] overflow-hidden rounded-xl border border-black/10 shadow-sm"
              >
                <Image
                  src={ej.src}
                  alt={ej.alt}
                  fill
                  sizes="(min-width: 448px) 144px, 33vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </section>

        {/* 9. TEXTO LARGO DEL PRODUCTO — texto exacto pedido. */}
        <section className="px-4 pb-8">
          <div className="mx-auto max-w-md rounded-2xl border border-black/5 bg-[#fffaf0] px-5 py-5 shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)]">
            <p className="text-sm leading-relaxed text-[#33456b]">
              Hacemos cuadros en vinilo laminado de excelente calidad sobre madera.
              Tienen un marco atrás de 3cm de profundidad para colgarlos. El envío
              es gratuito. No te preocupes por la calidad, ¡todas las imágenes
              sirven! Si tu imagen tiene poca calidad la aumentamos con
              Inteligencia Artificial sin afectar o cambiar detalles de la imagen.
              Seguirá siendo la misma, ¡pero mejor! Puedes pagar al recibir —
              tenemos alianza con Servientrega, Envía, Interrapidísimo y más, esto
              te da la confianza de que puedes pagar tu cuadro en la puerta de tu
              casa (anticipo de $20.000). Entrega en 3-5 días hábiles.
            </p>
          </div>
        </section>

        {/* 10. CATÁLOGO — mismo ProductScroller de "Recientes" del Home,
            con sus botones de compra normales. */}
        <section className="pb-8">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="font-heading mb-4 text-center text-xl font-bold tracking-tight sm:text-2xl">
              ¿Quieres comprar nuestros diseños?
            </h2>
            <ProductScroller items={recientes} light />
          </div>
        </section>

        {/* 11. GARANTÍA / FOOTER — discreto, exigido por políticas de
            anuncios de ecommerce de TikTok (contacto + garantía visibles). */}
        <section className="px-4">
          <div className="mx-auto max-w-md border-t border-black/10 pt-5 text-center">
            <p className="text-xs text-[#5b6b8c]">
              Tienes garantía ante daños de fábrica o de transporte. Tu cuadro
              está asegurado. Escríbenos a:{" "}
              <a href="mailto:pedidos@mysterycuadros.com" className="underline underline-offset-2">
                pedidos@mysterycuadros.com
              </a>
            </p>
            <p className="mt-3 text-[11px] text-[#8a94ac]">
              © 2026 Mystery. Todos los derechos reservados.
            </p>

            <FooterLegalAccordion />
          </div>
        </section>
      </main>

      {/* Aviso discreto de compra reciente — ventas reales, ver
          RecentPurchaseToast. Independiente del botón fijo (posiciones
          distintas), no interfiere con su ocultamiento por scroll. */}
      <RecentPurchaseToast />

      {/* 12. CTA FIJO — ya no navega a /crear, hace scroll suave hasta la
          sección embebida del punto 7 dentro de esta misma página. */}
      <StickyBuyButton targetId="crear-embed" />
    </div>
  );
}
