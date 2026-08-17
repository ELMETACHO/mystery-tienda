import Image from "next/image";
import Link from "next/link";
import { getBestSellingProducts, getRecentProducts } from "./lib/catalog";
import FoldText from "./components/FoldText";
import CategoryScroller from "./components/CategoryScroller";
import ProductScroller from "./components/ProductScroller";

// Esta página lee el catálogo real (Redis) en cada visita — nunca debe
// quedar cacheada mostrando productos viejos/borrados.
export const dynamic = "force-dynamic";

// Categorías reales de diseño usadas en /estudio para organizar los
// diseños en Google Drive (ver app/lib/estudioCategories.js).
const CATEGORIAS = [
  { id: "abstracto", nombre: "Abstracto", src: "/images/categorias/abstracto.jpg" },
  { id: "anime", nombre: "Ánime", src: "/images/categorias/anime.jpg" },
  { id: "deportes", nombre: "Deportes", src: "/images/categorias/deportes.jpg" },
  { id: "iconic", nombre: "Iconic", src: "/images/categorias/iconic.jpg" },
  { id: "musica", nombre: "Música", src: "/images/categorias/musica.jpg" },
  {
    id: "peliculas-series",
    nombre: "Películas y Series",
    src: "/images/categorias/series y películas.jpg",
  },
];

const FAQ = [
  {
    pregunta: "¿Qué calidad de foto necesito?",
    respuesta:
      "¡Entre mejor calidad tenga tu foto mejor se verá en tu pared! Si la imagen que deseas tiene una calidad baja podemos ajustarla con IA.",
  },
  {
    pregunta: "¿Cuánto tarda en llegar mi cuadro?",
    respuesta:
      "La producción toma entre 3 y 5 días hábiles desde que se confirma el pago, más el tiempo de envío según tu ciudad.",
  },
  {
    pregunta: "¿Qué métodos de pago aceptan?",
    respuesta:
      "Pagamos de forma segura a través de Wompi: tarjetas de crédito/débito, PSE, Nequi, Daviplata y contraentrega.",
  },
  {
    pregunta: "¿Hacen envíos a toda Colombia?",
    respuesta: "Sí, enviamos a todo el país.",
  },
  {
    pregunta: "¿Qué pasa si mi cuadro llega dañado?",
    respuesta:
      "Tienes garantía ante daños de fábrica o de transporte — escríbenos y lo solucionamos.",
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

// Contenido de ejemplo: reemplazar por testimonios reales de clientes (con
// foto real del cuadro que recibieron).
const TESTIMONIOS = [
  {
    nombre: "Camila R.",
    texto: "Pedí un cuadro de mi perro y quedó igualito. Llegó rapidísimo.",
    foto: "/images/catalogo/IMG_7340.JPG",
  },
  {
    nombre: "Andrés G.",
    texto: "La calidad de impresión superó lo que esperaba. 100% recomendado.",
    foto: "/images/catalogo/IMG_7336.PNG",
  },
  {
    nombre: "Laura M.",
    texto: "Súper fácil de personalizar desde el celular. Quedé feliz con el resultado.",
    foto: "/images/catalogo/IMG_7342.PNG",
  },
];

export default async function Home() {
  const [recientes, masVendidos] = await Promise.all([
    getRecentProducts(8),
    getBestSellingProducts(8),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      {/* 1. NAVBAR FIJA */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="shrink-0" aria-label="Mystery — Inicio">
            <Image
              src="/images/Logo/logo-navbar.png"
              alt="Mystery"
              width={150}
              height={101}
              priority
              className="h-8 w-auto sm:h-9"
            />
          </Link>
          <nav className="flex items-center gap-4 overflow-x-auto text-sm text-zinc-300 sm:gap-6">
            <a href="#personalizados" className="whitespace-nowrap hover:text-white">
              Personalizados
            </a>
            <a href="#recientes" className="whitespace-nowrap hover:text-white">
              Recientes
            </a>
            <a href="#mas-vendidos" className="whitespace-nowrap hover:text-white">
              Más vendidos
            </a>
            <a href="#footer" className="whitespace-nowrap hover:text-white">
              Ayuda
            </a>
          </nav>
          <Link
            href="#vender"
            className="hidden shrink-0 whitespace-nowrap text-xs text-zinc-500 hover:text-zinc-300 sm:block"
          >
            Gana dinero vendiendo cuadros
          </Link>
        </div>
      </header>

      <main className="flex-1 pt-14">
        {/* 2. HERO — centrado en el texto animado (FoldText), sin imagen
            lateral: la imagen de estilo de vida (head.png) se quitó, el
            hero ahora vive del efecto de "pliegue" del título. */}
        <section className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
          <div
            className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
            style={{ background: "var(--accent)" }}
          />

          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs tracking-wide text-accent-soft sm:text-sm">
              Cuadros en vinilo sobre madera
            </span>

            <p className="text-center text-xs font-medium text-accent-soft sm:text-sm">
              Por tiempo limitado: Envío gratis a todo el país
            </p>

            <FoldText
              text="Transforma tus mejores recuerdos en cuadros de alta calidad"
              splitBy="word"
              trigger="mount"
              fontSize="clamp(2.5rem, 6vw, 4.5rem)"
              fontWeight={800}
              color="#ffffff"
              className="leading-tight tracking-tight"
            />

            <p className="max-w-md text-base text-zinc-400 sm:text-lg">
              ¿Quieres un cuadro personalizado con tus propias imágenes o fotos? Toca el botón.
            </p>

            <Link
              href="/crear"
              className="inline-flex w-full max-w-xs items-center justify-center whitespace-nowrap rounded-full bg-accent px-8 py-4 text-center text-base font-semibold text-white shadow-lg shadow-accent/30 transition-colors hover:bg-accent-soft sm:w-auto sm:px-10 sm:text-lg"
            >
              Personalizar mi Cuadro Ahora
            </Link>
          </div>
        </section>

        {/* 2.5 CATEGORÍAS EMOCIONALES — tarjetas con foto de fondo en vez de
            chips de texto, como invitación visual más que filtro técnico.
            Queda justo después del hero/CTA a pedido explícito (no forma
            parte de la lista numerada de 8 secciones, pero se mantiene
            cerca del tope como exploración temprana por categoría). */}
        <section className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-4 text-lg font-semibold sm:text-xl">Elige tu estilo</h2>
            <CategoryScroller categorias={CATEGORIAS} />
          </div>
        </section>

        {/* 3. RECIENTES — productos reales del catálogo (Redis), más
            nuevos primero. Fila con scroll horizontal nativo (ver
            ProductScroller) — mismo patrón que CategoryScroller, sin
            animación ni bucle. */}
        <section id="recientes" className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold sm:text-xl">Recientes</h2>
            </div>
            <ProductScroller items={recientes} />
          </div>
        </section>

        {/* 4. MÁS VENDIDOS — por salesCount descendente. Sin ventas
            reales todavía, todos empatan en 0 y el desempate por fecha
            hace que coincida con "Recientes" (esperado, ver
            getBestSellingProducts en app/lib/catalog.js). */}
        <section id="mas-vendidos" className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-lg font-semibold sm:text-xl">Más vendidos</h2>
            </div>
            <ProductScroller items={masVendidos} />
          </div>
        </section>

        {/* 5. RESEÑAS — calificación, contador y testimonios con foto. */}
        <section className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 rounded-3xl border border-white/10 bg-white/5 px-6 py-12 text-center sm:px-12">
            <div className="flex flex-col items-center gap-2">
              <span className="text-2xl tracking-wide text-accent-soft" aria-hidden="true">
                ★★★★★
              </span>
              <p className="text-sm text-zinc-400 sm:text-base">
                4.9/5 con más de 1.000 pedidos
              </p>
              <p className="text-4xl font-black tracking-tight text-accent-soft sm:text-5xl">
                +1.000
              </p>
              <p className="text-sm text-zinc-400 sm:text-base">cuadros entregados</p>
            </div>

            {/* Contenido de ejemplo: reemplazar por testimonios reales, con
                foto real del cuadro que recibió cada cliente. */}
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
              {TESTIMONIOS.map((t) => (
                <div
                  key={t.nombre}
                  className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 text-left"
                >
                  <div className="relative aspect-video w-full overflow-hidden">
                    <Image
                      src={t.foto}
                      alt={`Cuadro recibido por ${t.nombre} (foto de ejemplo)`}
                      fill
                      sizes="(min-width: 640px) 33vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-5">
                    <span className="text-sm text-accent-soft" aria-hidden="true">
                      ★★★★★
                    </span>
                    <p className="mt-2 text-sm text-zinc-300">&ldquo;{t.texto}&rdquo;</p>
                    <p className="mt-3 text-xs font-medium text-zinc-500">
                      {t.nombre} · cliente de ejemplo
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. CUADROS PERSONALIZADOS — bloque explicativo con su propio CTA
            hacia /crear. */}
        <section id="personalizados" className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div
            className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 overflow-hidden rounded-3xl border border-white/10 px-6 py-14 text-center sm:gap-8 sm:px-12 sm:py-20"
            style={{
              background:
                "radial-gradient(circle at 30% 20%, rgba(168,85,247,0.35), transparent 60%), radial-gradient(circle at 80% 80%, rgba(192,132,252,0.25), transparent 55%), #131018",
            }}
          >
            <span className="rounded-full bg-white/10 px-4 py-1 text-xs font-medium tracking-wide text-accent-soft">
              Hecho para ti
            </span>
            <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">
              Cuadros personalizados
            </h2>
            <p className="max-w-xl text-base text-zinc-300 sm:text-lg">
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
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-zinc-300">
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-accent-soft">
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
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-accent-soft">
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
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Cómo funciona
              </h2>
              <p className="text-sm text-accent-soft sm:text-base">
                Menos de 2 minutos para personalizar tu cuadro
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-4">
              {PASOS.map((paso, i) => (
                <div
                  key={paso.titulo}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-5 text-center sm:gap-3 sm:px-6 sm:py-8"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent-soft sm:h-16 sm:w-16">
                    {paso.icono}
                  </span>
                  <span className="text-xs font-medium text-zinc-500">
                    Paso {i + 1}
                  </span>
                  <h3 className="font-semibold">{paso.titulo}</h3>
                  <p className="text-sm text-zinc-400">{paso.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7.5 GANA DINERO VENDIENDO CUADROS — apartado pequeño pero visible
            que refuerza el link discreto que ya existe en la navbar/footer
            (mismo ancla #vender, placeholder sin funcionalidad todavía). */}
        <section className="px-4 pb-10 sm:px-6 sm:pb-16">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-center sm:flex-row sm:justify-between sm:gap-6 sm:px-10">
            <p className="text-sm font-medium text-zinc-200 sm:text-base">
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

        {/* 8. PREGUNTAS FRECUENTES — acordeón nativo (details/summary), sin
            JS extra, mismo patrón ya usado en el resumen colapsable del
            checkout. */}
        <section className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-6 text-center text-2xl font-bold tracking-tight sm:text-3xl">
              Preguntas frecuentes
            </h2>
            <div className="flex flex-col divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/5">
              {FAQ.map((item) => (
                <details key={item.pregunta} className="group p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-zinc-100 sm:text-base">
                    {item.pregunta}
                    <span className="shrink-0 text-zinc-500 transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-zinc-400">{item.respuesta}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* 11. FOOTER */}
      <footer id="footer" className="border-t border-white/10 px-4 py-12 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:justify-between">
          <div>
            <p className="text-lg font-bold tracking-tight">Mystery</p>
            <p className="mt-2 max-w-xs text-sm text-zinc-500">
              Cuadros personalizados en vinilo sobre madera.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:flex sm:gap-16">
            <div className="flex flex-col gap-2 text-sm">
              <span className="mb-1 font-medium text-zinc-300">Ayuda</span>
              <Link href="#" className="text-zinc-500 hover:text-white">
                Garantías
              </Link>
              <Link href="#" className="text-zinc-500 hover:text-white">
                Devoluciones
              </Link>
              <Link href="#" className="text-zinc-500 hover:text-white">
                Centro de ayuda
              </Link>
              <Link href="#" className="text-zinc-500 hover:text-white">
                Contacto
              </Link>
              <Link href="/referidos" className="text-zinc-500 hover:text-white">
                Programa de referidos
              </Link>
            </div>

            <div className="flex flex-col gap-3">
              <span className="mb-1 text-sm font-medium text-zinc-300">Síguenos</span>
              <div className="flex gap-3">
                {["Instagram", "Facebook", "TikTok"].map((red) => (
                  <Link
                    key={red}
                    href="#"
                    aria-label={red}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-xs text-zinc-400 transition-colors hover:border-accent hover:text-white"
                  >
                    {red[0]}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div id="vender" className="mx-auto mt-10 max-w-6xl border-t border-white/5 pt-6">
          <Link
            href="#"
            className="text-xs text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline"
          >
            Gana dinero vendiendo cuadros
          </Link>
        </div>

        <p className="mx-auto mt-4 max-w-6xl text-xs text-zinc-600">
          © {new Date().getFullYear()} Mystery. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
