import Image from "next/image";
import Link from "next/link";
import { getBestSellingProducts, getRecentProducts } from "./lib/catalog";
import { getHomeTestimonials } from "./lib/homeTestimonials";
import { SITE_URL } from "./lib/siteUrl";
import FoldText from "./components/FoldText";
import CategoryScroller from "./components/CategoryScroller";
import CustomerReviews from "./components/CustomerReviews";
import ProductScroller from "./components/ProductScroller";
import { ESTUDIO_CATEGORIES } from "./lib/estudioCategories";
import { JsonLd } from "./lib/structuredData";
import { LANDING_PAGES } from "./lib/landingPages";
import { CHRISTMAS_DEADLINE, isChristmasDeadlineActive } from "./lib/christmas";

// WebSite (oct 2026): le confirma a Google el nombre del sitio que muestra
// arriba del resultado ("Mystery Cuadros" en vez del dominio).
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Mystery Cuadros",
  alternateName: "Mystery",
  url: `${SITE_URL}/`,
  inLanguage: "es-CO",
};

// Esta página lee el catálogo real (Redis) en cada visita — nunca debe
// quedar cacheada mostrando productos viejos/borrados.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mystery Cuadros — Cuadros Personalizados con tu Foto | Envío Gratis Colombia",
  description:
    "Convierte tu foto favorita en un cuadro personalizado en vinilo sobre madera. Elige el tamaño, paga seguro y recíbelo en tu casa — envío gratis a toda Colombia.",
  alternates: { canonical: SITE_URL },
};

// Categorías reales de diseño, derivadas de la misma fuente única que usa
// /estudio para organizar los diseños en Google Drive (ver
// app/lib/estudioCategories.js) — así una categoría nueva aparece acá sola,
// sin necesidad de mantener una segunda lista a mano.
const CATEGORY_CARD_IDS = new Set([
  "abstracto",
  "anime",
  "deportes",
  "iconic",
  "musica",
  "peliculas-series",
  "mystery-disenos",
]);

const CATEGORIAS = ESTUDIO_CATEGORIES.map((category) => ({
  id: category.id,
  nombre: category.label,
  // Versión liviana (WebP 432px, ~20-50 KB) generada desde coverImage —
  // el original llega a pesar 2 MB (mystery-disenos.png). Si se agrega una
  // categoría nueva, generar también su public/images/categorias/card/<id>.webp
  // (ver BITACORA.md, sesión SEO oct 2026); mientras no exista, se usa el
  // original.
  src: CATEGORY_CARD_IDS.has(category.id) ? `/images/categorias/card/${category.id}.webp` : category.coverImage,
}));

const FAQ = [
  {
    pregunta: "¿Qué calidad de foto necesito?",
    respuesta:
      "¡Entre mejor calidad tenga tu foto mejor se verá en tu pared! Antes de imprimir, revisamos tu foto con ayuda de IA para detectar problemas como baja resolución, poco enfoque o mal encuadre, y nuestro equipo la revisa antes de producir tu cuadro.",
  },
  {
    pregunta: "¿Cuánto tarda en llegar mi cuadro?",
    respuesta:
      "Lo hacemos en 1 a 2 días y te llega en máximo 5 días desde que se confirma el pago (la transportadora no entrega los domingos).",
  },
  {
    pregunta: "¿Qué métodos de pago aceptan?",
    respuesta:
      "Pagas de forma segura con Wompi: tarjeta de crédito o débito, PSE, y Nequi o Daviplata (se pagan desde PSE; también con QR o llaves). O contraentrega: anticipo de $20.000 y el resto al recibir.",
  },
  {
    pregunta: "¿Hacen envíos a toda Colombia?",
    respuesta: "Sí, enviamos a todo el país y el envío es gratis.",
  },
  {
    pregunta: "¿Qué pasa si mi cuadro llega dañado?",
    respuesta:
      "Aceptamos devoluciones únicamente por defectos de fábrica o daños durante el transporte. Debes reportarlo dentro de los primeros días de recibido, adjuntando evidencia fotográfica — requisito de la transportadora. También aplica si el diseño llegó erróneo o con mala calidad de impresión: adjunta evidencia y lo solucionamos. El anticipo de $20.000 (pedidos contraentrega) no es reembolsable si el pedido no puede entregarse por ausencia repetida en la dirección indicada, tras varios intentos de la transportadora. Esto es distinto a pérdida o daño del producto durante el transporte, que sí está cubierto por nuestra garantía. Si eres cliente y deseas un nuevo intento, debes cubrir los costos del segundo envío.",
  },
];

const PASOS = [
  {
    titulo: "Sube tu foto",
    texto: "PNG, JPG, HEIC o PDF.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 sm:h-9 sm:w-9">
        <path
          d="M12 16V4m0 0-4 4m4-4 4 4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    titulo: "Ajústala",
    texto: "Mueve, haz zoom y elige el tamaño.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 sm:h-9 sm:w-9">
        <rect
          x="4"
          y="4"
          width="12"
          height="12"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M16 8h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    titulo: "Paga seguro",
    texto: "Con Wompi, en unos segundos.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 sm:h-9 sm:w-9">
        <path
          d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="m9 12 2 2 4-4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    titulo: "Recíbelo en tu casa",
    texto: "Directo a tu dirección.",
    icono: (
      <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 sm:h-9 sm:w-9">
        <path
          d="M3 7h11v8H3V7Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M14 10h4l3 3v2h-7v-5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="7" cy="17" r="1.7" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.5" cy="17" r="1.7" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
];

// Último recurso: SOLO se usa si todavía no hay al menos 4 testimonios
// reales guardados en Redis (home:testimonials, ver
// app/lib/homeTestimonials.js y el cron semanal
// app/api/cron/select-home-testimonials/route.js). No debería verse en
// producción una vez haya suficientes reseñas reales de clientes.
const TESTIMONIOS_EJEMPLO = [
  {
    nombre: "Camila R.",
    texto: "Pedí un cuadro de mi perro y quedó igualito. Llegó rapidísimo.",
  },
  {
    nombre: "Andrés G.",
    texto: "La calidad de impresión superó lo que esperaba. 100% recomendado.",
  },
  {
    nombre: "Laura M.",
    texto: "Súper fácil de personalizar desde el celular. Quedé feliz con el resultado.",
  },
];

// Mínimo de testimonios reales para preferirlos sobre el fallback de
// ejemplo — con menos de esto, la sección se vería pobre.
const MIN_REAL_TESTIMONIALS = 4;

// WhatsApp del negocio ("CUADROS MYSTERY") — el mismo número que ya usan el
// chatbot (app/components/ChatWidget.jsx, app/lib/chatSystemPrompt.js), el
// panel de referidos y el origen de las guías de Skydropx. Destino real del
// link "Contacto" del footer.
const WHATSAPP_URL = "https://wa.me/573202646716";

// Redes sociales oficiales de Mystery (confirmadas por el dueño, oct 2026)
// — mismas URLs que el `sameAs` del JSON-LD Organization en app/layout.js.
// El bloque "Síguenos" solo se muestra con las redes que tengan URL: nunca
// volver a un href="#" (enlace roto para usuarios y buscadores).
const SOCIAL_LINKS = [
  { red: "Instagram", href: "https://www.instagram.com/bigmystery_/" },
  { red: "Facebook", href: "https://www.facebook.com/profile.php?id=61581688500822" },
  { red: "TikTok", href: "https://www.tiktok.com/@bigmystery_" },
].filter((social) => social.href);

// Íconos de las redes en SVG en línea (oct 2026) — antes eran las letras
// "I", "F", "T" dentro de un círculo, que se veían sin terminar. Sin
// librería ni peticiones extra; heredan el color del enlace (currentColor).
const SOCIAL_ICONS = {
  Instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  ),
  Facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.6l.4-3.1h-3V8.5c0-.9.3-1.5 1.6-1.5h1.6V4.2c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.3H7.9v3.1h2.6V21h3Z" />
    </svg>
  ),
  TikTok: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M16.6 3c.3 2.2 1.6 3.6 3.9 3.8v2.6c-1.4.1-2.6-.3-3.9-1.1v5.6c0 3.6-2.6 5.9-5.9 5.6-2.9-.3-4.9-2.8-4.6-5.8.3-2.9 2.9-5 6-4.6v2.8c-.5-.1-.9-.2-1.4-.1-1.4.2-2.3 1.4-2.1 2.7.2 1.3 1.3 2.2 2.6 2.1 1.3-.1 2.3-1.1 2.3-2.6V3h3.1Z" />
    </svg>
  ),
};

export default async function Home() {
  const [recientes, masVendidos, testimoniosReales] = await Promise.all([
    getRecentProducts(200),
    getBestSellingProducts(200),
    getHomeTestimonials(),
  ]);

  const testimonios =
    testimoniosReales.length >= MIN_REAL_TESTIMONIALS ? testimoniosReales : TESTIMONIOS_EJEMPLO;
  const testimoniosSonReales = testimonios !== TESTIMONIOS_EJEMPLO;

  return (
    <div
      className="tienda relative flex flex-1 flex-col overflow-hidden bg-[#8fcaf0] text-[#1b2a4a]"
    >
      <JsonLd data={websiteJsonLd} />
      {/* Fondo de cielo con nubes, fijo respecto al viewport (no se mueve
          con el scroll) — imagen propia con blur leve horneado (ver
          public/images/walls/fondo-cielo.webp), un solo tono uniforme sin
          degradado oscuro/claro. position:fixed en vez de
          background-attachment:fixed porque este último es poco confiable
          en Safari iOS. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/walls/fondo-cielo-2.webp)" }}
      />

      {/* 1. NAVBAR FIJA */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-black/10 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="shrink-0" aria-label="Mystery — Inicio">
            <Image
              src="/images/Logo/logo-navbar.png"
              alt="Mystery"
              width={155}
              height={100}
              priority
              unoptimized
              className="h-8 w-auto sm:h-9"
            />
          </Link>
          <nav className="flex items-center gap-4 overflow-x-auto text-sm text-[#1b2a4a]/80 sm:gap-6">
            <a href="#personalizados" className="whitespace-nowrap hover:text-[#1b2a4a]">
              Personalizados
            </a>
            <a href="#recientes" className="whitespace-nowrap hover:text-[#1b2a4a]">
              Recientes
            </a>
            <a href="#mas-vendidos" className="whitespace-nowrap hover:text-[#1b2a4a]">
              Más vendidos
            </a>
            <a href="#footer" className="whitespace-nowrap hover:text-[#1b2a4a]">
              Ayuda
            </a>
          </nav>
          <Link
            href="/referidos"
            className="hidden shrink-0 whitespace-nowrap text-xs text-[#1b2a4a]/60 hover:text-[#1b2a4a] sm:block"
          >
            Gana dinero vendiendo cuadros
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 pt-14">
        {/* 2. HERO — centrado en el texto animado (FoldText), sin imagen
            lateral: la imagen de estilo de vida (head.png) se quitó, el
            hero ahora vive del efecto de "pliegue" del título. */}
        <section className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
          <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-6 text-center">
            <p className="text-center text-xs font-medium text-[#7a3fa0] sm:text-sm">
              Por tiempo limitado: Envío gratis a todo el país
            </p>

            {/* Único <h1> de la Home (SEO): la marca animada (FoldText ya
                incluye el texto real en un span sr-only, la animación es
                aria-hidden) + una bajada visible que describe qué se vende.
                Ambos son <span> dentro del mismo h1 para que el encabezado
                principal diga "Mystery Cuadros — Cuadros personalizados
                con tu foto..." sin cambiar el estilo del título. */}
            <h1 className="flex flex-col items-center gap-3">
              <FoldText
                text="Mystery Cuadros"
                splitBy="word"
                trigger="mount"
                fontSize="clamp(3rem, 9vw, 6rem)"
                fontWeight={800}
                color="#1b2a4a"
                className="font-brand leading-tight tracking-tight whitespace-nowrap"
                style={{ whiteSpace: "nowrap" }}
              />
              <span className="sr-only"> — </span>
              <span className="max-w-xl text-base font-medium text-[#33456b] sm:text-lg">
                Cuadros personalizados con tu foto, en vinilo sobre madera
              </span>
            </h1>

            <Link
              href="/crear"
              className="inline-flex w-full max-w-xs items-center justify-center whitespace-nowrap rounded-full bg-accent px-8 py-4 text-center text-base font-semibold text-white shadow-lg shadow-accent/30 transition-colors hover:bg-accent-soft sm:w-auto sm:px-10 sm:text-lg"
            >
              Personalizar mi Cuadro Ahora
            </Link>

            {/* Temporada de Navidad: enlace a la landing de regalos mientras
                esté vigente la fecha límite de app/lib/christmas.js (se
                apaga sola después). */}
            {isChristmasDeadlineActive() && (
              <Link
                href="/cuadros/regalo-de-navidad-personalizado"
                className="rounded-full border border-accent/30 bg-[#fffaf0] px-4 py-2 text-xs font-medium text-accent shadow-sm transition-colors hover:border-accent sm:text-sm"
              >
                🎄 Regalos de Navidad · {CHRISTMAS_DEADLINE.message} →
              </Link>
            )}
          </div>
        </section>

        {/* 2.5 CATEGORÍAS EMOCIONALES — tarjetas con foto de fondo en vez de
            chips de texto, como invitación visual más que filtro técnico.
            Queda justo después del hero/CTA a pedido explícito (no forma
            parte de la lista numerada de 8 secciones, pero se mantiene
            cerca del tope como exploración temprana por categoría). */}
        <section className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display mb-4 text-lg font-semibold sm:text-xl">Elige tu estilo</h2>
            <CategoryScroller categorias={CATEGORIAS} light />
          </div>
        </section>

        {/* 3. RECIENTES — productos reales del catálogo (Redis), más
            nuevos primero. Fila con scroll horizontal nativo (ver
            ProductScroller) — mismo patrón que CategoryScroller, sin
            animación ni bucle. */}
        <section id="recientes" className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4">
              <h2 className="font-display text-lg font-semibold sm:text-xl">Recientes</h2>
            </div>
            <ProductScroller items={recientes} light thumbWidth={480} />
          </div>
        </section>

        {/* 4. MÁS VENDIDOS — por salesCount descendente. Sin ventas
            reales todavía, todos empatan en 0 y el desempate por fecha
            hace que coincida con "Recientes" (esperado, ver
            getBestSellingProducts en app/lib/catalog.js). */}
        <section id="mas-vendidos" className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="font-display text-lg font-semibold sm:text-xl">Más vendidos</h2>
            </div>
            <ProductScroller items={masVendidos} light thumbWidth={480} />
          </div>
        </section>

        {/* 5. RESEÑAS — calificación, contador y testimonios con foto. */}
        <section className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 rounded-[2.5rem] border border-black/5 bg-[#fffaf0] px-6 py-12 text-center shadow-[0_16px_40px_-16px_rgba(30,20,60,0.25)] sm:px-12">
            <div className="flex flex-col items-center gap-2">
              {/* Dato confirmado por el dueño (oct 2026): +1.000 cuadros
                  entregados desde 2019, la mayoría por Instagram (la web es
                  nueva). Sin calificación promedio: no hay fuente que la
                  respalde (las reseñas de /resena no se promedian). */}
              <p className="text-4xl font-black tracking-tight text-accent sm:text-5xl">
                +1.000
              </p>
              <p className="text-sm text-[#33456b] sm:text-base">cuadros entregados desde 2019</p>
              <p className="text-xs text-[#5b6b8c] sm:text-sm">
                La mayoría vendidos por Instagram{" "}
                <a
                  href="https://www.instagram.com/bigmystery_/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent underline-offset-4 hover:underline"
                >
                  @bigmystery_
                </a>
              </p>
            </div>

            {/* testimonios viene de Redis (home:testimonials, reseñas reales
                seleccionadas semanalmente por IA) cuando hay al menos
                MIN_REAL_TESTIMONIALS — si no, cae a TESTIMONIOS_EJEMPLO
                arriba. Sin foto a propósito: mostrar una foto genérica de
                pared junto a una reseña real daría a entender que es del
                cuadro de ese cliente sin serlo. Las fotos REALES de
                clientes van aparte, en <CustomerReviews> debajo. */}
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
              {testimonios.map((t, i) => (
                <div
                  key={`${t.nombre}-${i}`}
                  className="flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white text-left shadow-sm"
                >
                  <div className="p-5">
                    <span className="text-sm text-accent" aria-hidden="true">
                      {"★".repeat(t.rating || 5)}
                    </span>
                    <p className="mt-2 text-sm text-[#1b2a4a]">&ldquo;{t.texto}&rdquo;</p>
                    <p className="mt-3 text-xs font-medium text-[#5b6b8c]">
                      {t.nombre}
                      {t.sizeLabel ? ` · cuadro ${t.sizeLabel}` : ""}
                      {!testimoniosSonReales ? " · cliente de ejemplo" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fotos reales de clientes (aprobadas en /admin/resenas, con
              autorización). Se piden recién al acercarse a esta sección y
              no pintan nada si todavía no hay ninguna aprobada. */}
          <CustomerReviews onlyPhotos className="mx-auto mt-8 max-w-6xl" />
        </section>

        {/* 6. CUADROS PERSONALIZADOS — bloque explicativo con su propio CTA
            hacia /crear. */}
        <section id="personalizados" className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div
            className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 overflow-hidden rounded-[2.5rem] border border-black/5 px-6 py-14 text-center shadow-[0_16px_40px_-16px_rgba(30,20,60,0.25)] sm:gap-8 sm:px-12 sm:py-20"
            style={{
              background:
                "radial-gradient(circle at 25% 15%, rgba(168,85,247,0.12), transparent 55%), radial-gradient(circle at 85% 85%, rgba(244,164,200,0.18), transparent 55%), #fffaf0",
            }}
          >
            <span className="rounded-full bg-[#f3e8ff] px-4 py-1 text-xs font-medium tracking-wide text-accent">
              Hecho para ti
            </span>
            <h2 className="font-display max-w-2xl text-3xl font-extrabold tracking-tight text-[#1b2a4a] sm:text-5xl">
              Cuadros personalizados
            </h2>
            <p className="max-w-xl text-base text-[#33456b] sm:text-lg">
              Sube tu foto, ajústala dentro del marco y elige el tamaño. Nosotros
              lo imprimimos en vinilo sobre madera y te lo llevamos hasta la puerta.
            </p>
            <Link
              href="/crear"
              className="mt-2 w-full max-w-xs rounded-full bg-accent px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-accent/30 transition-colors hover:bg-accent-soft sm:w-auto"
            >
              Crear mi cuadro
            </Link>

            {/* Badges de confianza */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-[#33456b]">
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-accent">
                  <path
                    d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <path
                    d="m9 12 2 2 4-4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Pago seguro
              </span>
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-accent">
                  <path
                    d="M3 7h11v8H3V7Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 10h4l3 3v2h-7v-5Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <circle cx="7" cy="17" r="1.6" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="17.5" cy="17" r="1.6" stroke="currentColor" strokeWidth="1.6" />
                </svg>
                Envíos a toda Colombia
              </span>
            </div>
          </div>
        </section>

        {/* 7. CÓMO FUNCIONA — íconos grandes y mensaje de rapidez, justo
            antes del apartado de "vender" y del FAQ. */}
        <section className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex flex-col items-center gap-2 text-center">
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Cómo funciona
              </h2>
              <p className="text-sm text-accent sm:text-base">
                Menos de 2 minutos para personalizar tu cuadro
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-4">
              {PASOS.map((paso, i) => (
                <div
                  key={paso.titulo}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-black/5 bg-[#fffaf0] px-3 py-5 text-center shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)] sm:gap-3 sm:px-6 sm:py-8"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent sm:h-16 sm:w-16">
                    {paso.icono}
                  </span>
                  <span className="text-xs font-medium text-[#8a94ac]">
                    Paso {i + 1}
                  </span>
                  <h3 className="font-semibold text-[#1b2a4a]">{paso.titulo}</h3>
                  <p className="text-sm text-[#33456b]">{paso.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7.5 GANA DINERO VENDIENDO CUADROS — apartado pequeño pero visible
            que refuerza el link discreto que ya existe en la navbar/footer
            (los tres apuntan a /referidos, el programa de embajadores). */}
        <section className="px-4 pb-10 sm:px-6 sm:pb-16">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 rounded-2xl border border-[#f6d989]/60 bg-[#fdf1cf] px-6 py-8 text-center shadow-sm sm:flex-row sm:justify-between sm:gap-6 sm:px-10">
            <p className="text-sm font-medium text-[#1b2a4a] sm:text-base">
              💰 Gana dinero vendiendo cuadros con Mystery
            </p>
            <Link
              href="/referidos"
              className="shrink-0 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-accent/25 transition-colors hover:bg-accent-soft"
            >
              Toca aquí
            </Link>
          </div>
        </section>

        {/* 7.8 IDEAS — enlaces internos a las landings de intención de
            compra (app/lib/landingPages.js, oct 2026): regalos de Navidad,
            aniversario, mascotas, sala... Ayudan a que Google las descubra
            y le dan al visitante una puerta de entrada por ocasión. */}
        <section id="ideas" className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display mb-4 text-lg font-semibold sm:text-xl">Ideas para regalar y decorar</h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {LANDING_PAGES.map((landing) => (
                <li key={landing.slug}>
                  <Link
                    href={`/cuadros/${landing.slug}`}
                    className="flex h-full items-center justify-between gap-3 rounded-2xl border border-black/5 bg-[#fffaf0] px-5 py-4 text-sm font-medium text-[#1b2a4a] shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)] transition-colors hover:border-accent"
                  >
                    {landing.christmas ? `🎄 ${landing.navLabel}` : landing.navLabel}
                    <span aria-hidden="true" className="text-accent">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 8. PREGUNTAS FRECUENTES — acordeón nativo (details/summary), sin
            JS extra, mismo patrón ya usado en el resumen colapsable del
            checkout. id usado por "Centro de ayuda" del footer. */}
        <section id="preguntas-frecuentes" className="scroll-mt-20 px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display mb-6 text-center text-2xl font-bold tracking-tight sm:text-3xl">
              Preguntas frecuentes
            </h2>
            <div className="flex flex-col divide-y divide-black/5 rounded-2xl border border-black/5 bg-[#fffaf0] shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)]">
              {FAQ.map((item) => (
                <details key={item.pregunta} className="group p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-[#1b2a4a] sm:text-base">
                    {item.pregunta}
                    <span className="shrink-0 text-accent transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-[#33456b]">{item.respuesta}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* 11. FOOTER */}
      <footer id="footer" className="relative z-10 border-t border-black/10 bg-white/50 px-4 py-12 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:justify-between">
          <div>
            <p className="text-lg font-bold tracking-tight text-[#1b2a4a]">Mystery</p>
            <p className="mt-2 max-w-xs text-sm text-[#5b6b8c]">
              Cuadros personalizados en vinilo sobre madera.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:flex sm:gap-16">
            <div className="flex flex-col gap-2 text-sm">
              <span className="mb-1 font-medium text-[#33456b]">Ayuda</span>
              <Link href="/pedido" className="text-[#5b6b8c] hover:text-[#1b2a4a]">
                Estado de mi pedido
              </Link>
              <Link href="/politicas" className="text-[#5b6b8c] hover:text-[#1b2a4a]">
                Garantías
              </Link>
              <Link href="/politicas" className="text-[#5b6b8c] hover:text-[#1b2a4a]">
                Devoluciones
              </Link>
              {/* Sin página /ayuda propia todavía: el centro de ayuda real
                  hoy son las preguntas frecuentes de esta misma página. */}
              <a href="#preguntas-frecuentes" className="text-[#5b6b8c] hover:text-[#1b2a4a]">
                Centro de ayuda
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#5b6b8c] hover:text-[#1b2a4a]"
              >
                Contacto
              </a>
              <Link href="/referidos" className="text-[#5b6b8c] hover:text-[#1b2a4a]">
                Programa de referidos
              </Link>
            </div>

            <div className="flex flex-col gap-2 text-sm">
              <span className="mb-1 font-medium text-[#33456b]">Ideas</span>
              {LANDING_PAGES.map((landing) => (
                <Link
                  key={landing.slug}
                  href={`/cuadros/${landing.slug}`}
                  className="text-[#5b6b8c] hover:text-[#1b2a4a]"
                >
                  {landing.navLabel}
                </Link>
              ))}
            </div>

            {SOCIAL_LINKS.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="mb-1 text-sm font-medium text-[#33456b]">Síguenos</span>
                <div className="flex gap-3">
                  {SOCIAL_LINKS.map(({ red, href }) => (
                    <a
                      key={red}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={red}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/60 text-[#33456b] transition-colors hover:border-accent hover:text-accent"
                    >
                      {SOCIAL_ICONS[red] || red[0]}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div id="vender" className="mx-auto mt-10 max-w-6xl border-t border-black/5 pt-6">
          {/* Mismo destino que el banner "Gana dinero vendiendo cuadros" de
              la Home: el programa de referidos/embajadores. */}
          <Link
            href="/referidos"
            className="text-xs text-[#5b6b8c] underline-offset-4 hover:text-[#1b2a4a] hover:underline"
          >
            Gana dinero vendiendo cuadros
          </Link>
        </div>

        <p className="mx-auto mt-4 max-w-6xl text-xs text-[#8a94ac]">
          © {new Date().getFullYear()} Mystery. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
