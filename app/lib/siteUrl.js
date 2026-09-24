export const SITE_URL =
  process.env.SITE_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://www.mysterycuadros.com");

// Base para links que salen en CORREOS (botón "generar guía", /fabricante,
// reseñas, etc.). Nunca puede ser localhost: un correo lo abre otra
// persona en otro dispositivo, donde localhost no existe. Caso real (sept
// 2026): un pedido reconstruido a mano corriendo el código desde la
// máquina de desarrollo (con SITE_URL=http://localhost:3000 en
// .env.local) le llegó al fabricante con el botón "generar guía"
// apuntando a localhost:3000.
const PRODUCTION_SITE_URL = "https://www.mysterycuadros.com";
export const EMAIL_SITE_URL = /localhost|127\.0\.0\.1/.test(SITE_URL)
  ? PRODUCTION_SITE_URL
  : SITE_URL;
