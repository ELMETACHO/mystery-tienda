import Image from "next/image";
import { preload } from "react-dom";
import { getRecentProducts } from "../lib/catalog";
import { getRecentSalesForToast } from "../lib/completedOrders";
import { PRICES, formatCOP } from "../lib/order";
import CrearFlow from "../components/CrearFlow";
import OfferBadges from "../components/ads/OfferBadges";
import StickyBuyButton from "../components/ads/StickyBuyButton";
import RecentPurchaseToast from "../components/ads/RecentPurchaseToast";
import FooterLegalAccordion from "../components/ads/FooterLegalAccordion";
import { resolverTemporada } from "./temporada";
import AdsHeroCta from "./AdsHeroCta";
import AdsFlowBridge from "./AdsFlowBridge";
import AdsFaq from "./AdsFaq";
import AdsCatalogStrip, { ADS_CATALOG_LIMIT } from "./AdsCatalogStrip";
import { WHATSAPP_URL } from "./contacto";

// Landing exclusiva para tráfico pagado de TikTok — un solo scroll, sin
// navbar/footer completo, sin nada que distraiga del CTA. No comparte
// layout con el Home (ver app/page.js): vive sola, un solo objetivo. El
// flujo de /crear vive embebido acá mismo (ver sección "crear-embed" más
// abajo, y app/components/CrearFlow.jsx) para que comprar no implique salir
// de la página del anuncio.
export const dynamic = "force-dynamic";

// noindex (SEO): landing de pauta pagada (TikTok) que repite el contenido
// del Home y de /crear (mismo CrearFlow, mismos diseños del catálogo) — en
// buscadores competiría con esas páginas como contenido duplicado y además
// sus textos de oferta están pensados para el anuncio, no para búsqueda
// orgánica. follow: true para que los links a productos sigan sumando.
// No está en app/sitemap.js a propósito. noindex NO afecta a los anuncios:
// TikTok/Meta/Google Ads mandan tráfico a la URL igual.
export const metadata = {
  title: "Mystery — Tu foto favorita, en un cuadro real",
  description: "Sube tu foto y recíbela en cuadro de vinilo sobre madera en tu casa.",
  robots: { index: false, follow: true },
};

// viewport-fit=cover habilita env(safe-area-inset-bottom) para que el botón
// sticky respete el home indicator de iPhone sin quedar tapado ni flotando.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// .webp de 480px de ancho (oct 2026) generados desde los PNG originales
// (PARED*.png, 1328x1760, ~2.7 MB cada uno → ~15-20 KB): se muestran a
// ~144px de ancho, así que el PNG completo era peso puro. Los PNG
// originales quedan en public/ como fuente por si hay que regenerarlos.
const EJEMPLOS = [
  { src: "/images/page-ads/PARED1.webp", alt: "Cuadro Mystery entregado, colgado en la pared de un cliente" },
  { src: "/images/page-ads/PARED2.webp", alt: "Cuadro Mystery entregado, colgado en la pared de un cliente" },
  { src: "/images/page-ads/PARED3.webp", alt: "Cuadro Mystery entregado, colgado en la pared de un cliente" },
];

// Póster del video del hero = elemento LCP de la página (Lighthouse, oct
// 2026). Versión .webp (~50 KB vs. ~124 KB del .jpg) + preload con
// prioridad alta para que se pinte antes que cualquier otra imagen.
const HERO_POSTER = "/images/page-ads/hero-poster.webp";

// Precio "desde" calculado de app/lib/order.js (no a mano): el más barato
// de todos los tamaños/tipos — hoy 30x40 Tradicional.
const DESDE_COP = Math.min(
  ...Object.values(PRICES).flatMap((porTamano) => Object.values(porTamano))
);

export default async function AdsLanding({ searchParams }) {
  preload(HERO_POSTER, { as: "image", fetchPriority: "high" });

  const params = (await searchParams) || {};
  const temporada = resolverTemporada(params);

  const [recientes, ventasRecientes] = await Promise.all([
    getRecentProducts(ADS_CATALOG_LIMIT),
    getRecentSalesForToast(),
  ]);

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-[#8fcaf0] text-[#1b2a4a]">
      {/* Mismo fondo fijo del Home/​/crear: la foto de cielo no se mueve
          con el scroll. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/walls/fondo-cielo-2.webp)" }}
      />

      {/* Atribución (UTM/ttclid → dataLayer) + puente con CrearFlow (baja
          al editor cuando la foto se sube desde el CTA de arriba o la
          barra fija). Invisible. */}
      <AdsFlowBridge targetId="crear-embed" temporada={temporada.id} />

      {/* 1. HEADER FIJO — position:fixed (no sticky, mismo criterio que el
          botón inferior: sticky puede "despegarse" en Safari durante el
          scroll). Solo esta franja, nada más. Se deja negra a propósito:
          es la cinta del anuncio, no forma parte del "tema" de la página.
          El texto cambia por temporada (ver temporada.js). */}
      <div className="fixed inset-x-0 top-0 z-50 bg-black px-4 py-2.5 text-center">
        <p className="text-xs font-semibold text-red-500 sm:text-sm">{temporada.barra}</p>
      </div>

      <main className="relative z-10 flex-1 pb-36 pt-11">
        {/* 2. PRIMER PANTALLAZO (oct 2026) — todo lo que decide si el
            visitante de TikTok se queda tiene que caber en ~650px de alto
            (navegador interno de TikTok, celular promedio): qué es
            (título que repite la promesa del anuncio), cuánto cuesta, una
            muestra visual y UN botón principal en la zona del pulgar.
            Antes el título y el precio quedaban debajo del video, fuera de
            la primera pantalla. */}
        <section className="px-4 pb-5 pt-4 text-center">
          <p className="font-brand text-lg tracking-tight text-[#1b2a4a]">Mystery Cuadros</p>
          <h1 className="font-heading mx-auto mt-1 max-w-md text-[1.6rem] font-extrabold leading-[1.15] tracking-tight text-[#1b2a4a] sm:text-3xl">
            {temporada.titulo}
          </h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#33456b]">{temporada.subtitulo}</p>
          <p className="mt-1 text-lg font-bold text-accent">
            Desde {formatCOP(DESDE_COP)}{" "}
            <span className="text-xs font-semibold text-emerald-800">· envío incluido</span>
          </p>

          {/* Video en vez de GIF: el archivo original (Freepik) pesaba
              95MB; convertido a MP4 (h264, ~0.9MB) con la misma animación.
              autoPlay + muted + loop + playsInline arranca solo en Safari
              iOS y Chrome Android. El alto se limita con svh para que el
              CTA de abajo siga dentro de la primera pantalla incluso en
              celulares bajitos. */}
          <div
            className="relative mx-auto mt-3 aspect-[4/5] w-64 max-w-full overflow-hidden rounded-2xl border border-black/10 shadow-lg shadow-accent/20"
            style={{ width: "min(16rem, 30svh, 100%)" }}
          >
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster={HERO_POSTER}
              className="h-full w-full object-cover"
              aria-label="Cuadro personalizado Mystery, animación de muestra"
            >
              <source src="/images/page-ads/hero-loop.mp4" type="video/mp4" />
            </video>
          </div>

          <div id="ads-hero-cta" className="mx-auto mt-4 max-w-sm">
            <AdsHeroCta label={temporada.cta} targetId="crear-embed" />
            <p className="mt-2 text-xs font-semibold text-[#33456b]">
              👀 Ves cómo queda antes de pagar · 💵 Paga al recibir
            </p>
            {temporada.avisoNavidad && (
              <p className="mt-2 rounded-xl border border-red-700/20 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
                {temporada.avisoNavidad.aviso}
              </p>
            )}
          </div>
        </section>

        {/* 3. OFERTA REAL — envío gratis + paga al recibir (ver
            OfferBadges). Reemplaza la cuenta regresiva y el contador de
            visitas simulados que había antes. */}
        <section className="px-4 pb-4">
          <OfferBadges />
        </section>

        {/* 4. CONFIANZA — solo datos verdaderos y ya publicados en el sitio:
            tiempos confirmados por el dueño (oct 2026), medios de pago del
            checkout (Wompi: tarjeta/PSE + contraentrega), garantía de las
            políticas y WhatsApp real de atención. */}
        <section className="px-4 pb-7">
          <ul className="mx-auto grid max-w-md grid-cols-2 gap-2 text-[11px] leading-snug text-[#33456b]">
            <li className="rounded-xl border border-black/5 bg-[#fffaf0] px-3 py-2">
              <span className="block font-bold text-[#1b2a4a]">⚡ Hecho en 1-2 días</span>
              Llega en máximo 5 días hábiles
            </li>
            <li className="rounded-xl border border-black/5 bg-[#fffaf0] px-3 py-2">
              <span className="block font-bold text-[#1b2a4a]">🔒 Pago seguro</span>
              Wompi: tarjeta o PSE
            </li>
            <li className="rounded-xl border border-black/5 bg-[#fffaf0] px-3 py-2">
              <span className="block font-bold text-[#1b2a4a]">🛡️ Garantía</span>
              Ante daños de fábrica o transporte
            </li>
            <li className="rounded-xl border border-black/5 bg-[#fffaf0] px-3 py-2">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="block">
                <span className="block font-bold text-[#1b2a4a]">💬 WhatsApp</span>
                <span className="underline underline-offset-2">Te respondemos ahí</span>
              </a>
            </li>
          </ul>
        </section>

        {/* 5. FLUJO DE /crear EMBEBIDO — mismo componente que usa /crear
            (app/components/CrearFlow.jsx), en modo "compact": misma lógica
            de subida/recorte/tamaño/confirmación, sin la cabecera grande
            que no tiene sentido en medio de esta página. */}
        <section id="crear-embed" className="scroll-mt-12 px-4 pb-8">
          <h2 className="font-heading text-center text-xl font-bold tracking-tight sm:text-2xl">
            {temporada.tituloFlujo}
          </h2>
          <div className="mb-4 mt-1.5">
            <OfferBadges variant="pill" />
          </div>
          <CrearFlow compact />
        </section>

        {/* 6. TESTIMONIOS — sin reseñas reales todavía, se muestran cuadros
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
                  unoptimized
                  sizes="(min-width: 448px) 144px, 33vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </section>

        {/* 7. PREGUNTAS FRECUENTES + WhatsApp — objeciones típicas antes de
            comprar (ver AdsFaq). */}
        <section className="px-4 pb-8">
          <AdsFaq avisoNavidad={temporada.avisoNavidad} />
        </section>

        {/* 8. TEXTO LARGO DEL PRODUCTO — texto exacto pedido. */}
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

        {/* 9. CATÁLOGO — diseños más recientes, con miniaturas livianas
            (ver AdsCatalogStrip: antes este bloque descargaba ~34 MB). */}
        {recientes.length > 0 && (
          <section className="pb-8">
            <div className="mx-auto max-w-6xl px-4">
              <h2 className="font-heading text-center text-xl font-bold tracking-tight sm:text-2xl">
                ¿Quieres comprar nuestros diseños?
              </h2>
              <div className="mb-4 mt-1.5">
                <OfferBadges variant="pill" />
              </div>
              <AdsCatalogStrip items={recientes} />
            </div>
          </section>
        )}

        {/* 10. GARANTÍA / FOOTER — discreto, exigido por políticas de
            anuncios de ecommerce de TikTok (contacto + garantía visibles). */}
        <section className="px-4">
          <div className="mx-auto max-w-md border-t border-black/10 pt-5 text-center">
            <p className="text-xs text-[#5b6b8c]">
              Tienes garantía ante daños de fábrica o de transporte. Tu cuadro
              está asegurado. Escríbenos a:{" "}
              <a href="mailto:pedidos@mysterycuadros.com" className="underline underline-offset-2">
                pedidos@mysterycuadros.com
              </a>{" "}
              o por{" "}
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                WhatsApp (+57 320 264 6716)
              </a>
            </p>
            <p className="mt-3 text-[11px] text-[#8a94ac]">
              © 2026 Mystery. Todos los derechos reservados.
            </p>

            <FooterLegalAccordion />
          </div>
        </section>
      </main>

      {/* Aviso discreto de compra reciente — ventas reales (histórico +
          completed-orders en vivo), ver RecentPurchaseToast. Independiente del botón fijo (posiciones
          distintas), no interfiere con su ocultamiento por scroll. */}
      <RecentPurchaseToast liveSales={ventasRecientes} />

      {/* 11. CTA FIJO — sin foto, abre directo la galería (mismo input de
          CrearFlow); con foto, ejecuta el siguiente paso del flujo. */}
      <StickyBuyButton targetId="crear-embed" alsoHideWhenVisibleIds={["ads-hero-cta"]} />
    </div>
  );
}
