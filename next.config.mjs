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
};

export default nextConfig;
