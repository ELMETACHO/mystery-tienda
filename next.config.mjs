/** @type {import('next').NextConfig} */
const nextConfig = {
  // TEMPORAL: permite acceder al dev server desde el iPhone en la misma red
  // (vía IP LAN) para probar con Eruda. Recordar quitar junto con Eruda antes
  // de producción, o mantenerlo acotado si se conserva para futuras pruebas.
  allowedDevOrigins: ["192.168.2.8"],
  images: {
    // Miniaturas de productos del catálogo (/estudio → Drive → Home /
    // /producto/[id]) vienen de drive.google.com/thumbnail.
    remotePatterns: [{ protocol: "https", hostname: "drive.google.com" }],
  },
};

export default nextConfig;
