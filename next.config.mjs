/** @type {import('next').NextConfig} */
const nextConfig = {
  // TEMPORAL: permite acceder al dev server desde el iPhone en la misma red
  // (vía IP LAN) para probar con Eruda. Recordar quitar junto con Eruda antes
  // de producción, o mantenerlo acotado si se conserva para futuras pruebas.
  allowedDevOrigins: ["192.168.2.8"],
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
  },
};

export default nextConfig;
