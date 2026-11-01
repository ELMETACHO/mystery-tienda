// Cabeceras de seguridad (octubre 2026). Son estáticas: Vercel las agrega
// en el edge sin ejecutar código, así que no suman latencia.
//
// La CSP va en modo Report-Only: el navegador NO bloquea nada, solo avisa
// (consola + POST a /api/csp-report). Cuando los reportes estén limpios se
// puede pasar a "Content-Security-Policy" (enforcing). Orígenes sacados del
// código y de cargar Home, /crear, /checkout (con el widget de Wompi
// abierto), /ads, categorías, producto y landings: GTM + Google Ads/GA4,
// Meta Pixel, TikTok Pixel, Wompi, Vercel Analytics (mismo origen) y la
// subida a Google Drive de /estudio. 'unsafe-inline' es necesario porque el
// snippet de GTM, el JSON-LD y los scripts de Next son inline (usar nonces
// obligaría a renderizar todo dinámico, con costo de rendimiento).
const CSP_DIRECTIVES = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "https://www.googletagmanager.com",
    "https://*.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://*.google-analytics.com",
    "https://googleads.g.doubleclick.net",
    "https://www.googleadservices.com",
    "https://www.google.com",
    "https://connect.facebook.net",
    "https://analytics.tiktok.com",
    "https://checkout.wompi.co",
    "https://*.wompi.co",
    "https://*.wompi.com",
  ],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "font-src": ["'self'", "data:"],
  "media-src": ["'self'", "data:", "blob:"],
  "worker-src": ["'self'", "blob:"],
  "connect-src": [
    "'self'",
    "https://www.google-analytics.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://www.googletagmanager.com",
    "https://*.googletagmanager.com",
    "https://www.google.com",
    "https://www.google.com.co",
    "https://*.doubleclick.net",
    "https://www.googleadservices.com",
    "https://www.facebook.com",
    "https://connect.facebook.net",
    "https://analytics.tiktok.com",
    "https://*.tiktokw.us",
    "https://*.tiktok.com",
    "https://*.wompi.co",
    "https://*.wompi.com",
    "https://www.googleapis.com",
  ],
  "frame-src": [
    "https://checkout.wompi.co",
    "https://*.wompi.co",
    "https://www.googletagmanager.com",
    "https://*.doubleclick.net",
    "https://www.facebook.com",
  ],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  // facebook.com: el píxel de Meta envía algunos eventos con un formulario
  // oculto (POST a www.facebook.com/tr/) — sin esto, al pasar la CSP a
  // modo bloqueo esos eventos se perderían.
  "form-action": ["'self'", "https://*.wompi.co", "https://www.facebook.com"],
  "frame-ancestors": ["'self'"],
  "report-uri": ["/api/csp-report"],
};
const CSP_REPORT_ONLY = Object.entries(CSP_DIRECTIVES)
  .map(([directive, values]) => `${directive} ${values.join(" ")}`)
  .join("; ");

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // El sitio no usa cámara, micrófono ni ubicación (la foto se sube con
  // <input type="file">, que no depende de estos permisos).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

// Anti-clickjacking (sí se aplica, no es report-only). Se excluye a
// propósito /checkout/confirmacion: es el redirectUrl que se le pasa al
// widget de Wompi y, según el flujo/navegador, Wompi podría cargarlo
// dentro de su iframe (checkout.wompi.co); bloquearlo ahí dejaría al
// cliente sin pantalla de confirmación. Esa página no tiene acciones que
// un clickjacking pueda aprovechar.
const FRAME_HEADERS = [{ key: "X-Frame-Options", value: "SAMEORIGIN" }];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Desactivado tras diagnosticar (agosto 2026) que esta caché persiste en
  // disco (.next/dev/cache/turbopack) ENTRE reinicios del servidor — a
  // diferencia de lo que parece, un `Ctrl+C` + `npm run dev` normal NO la
  // limpia. Causó que /api/generate-shipment siguiera ejecutando una
  // versión vieja de app/lib/manufacturerFinance.js (sin los campos
  // sheetSyncFailed/sheetSyncError) durante varias pruebas reales seguidas,
  // pese a que el archivo en disco y otras rutas nuevas sí tenían el código
  // correcto. Activada por default desde Next.js 16.1.0
  // (experimental.turbopackFileSystemCacheForDev). Si se reactiva en el
  // futuro, cualquier cambio a un archivo de app/lib/ requiere borrar
  // manualmente `.next` (no solo reiniciar) para garantizar que todas las
  // rutas usen el código más reciente.
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  images: {
    // Miniaturas de productos del catálogo (/estudio → Drive → Home /
    // /producto/[id]) vienen de drive.google.com/thumbnail.
    remotePatterns: [{ protocol: "https", hostname: "drive.google.com" }],
    // Reducidos desde los defaults de Next (8+8 valores) a los anchos que
    // realmente se renderizan en el sitio (ver `sizes` de cada <Image>) —
    // menos combinaciones de ancho posibles = menos "Cache Writes" de
    // Image Optimization en Vercel (alcanzamos el límite gratuito de
    // 100.000 sin tráfico real, agosto 2026).
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [96, 128, 256, 384],
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/((?!checkout/confirmacion).*)", headers: FRAME_HEADERS },
    ];
  },
};

export default nextConfig;
