import { cookies } from "next/headers";
import { ESTUDIO_COOKIE_NAME, getEstudioSessionToken } from "../../lib/estudioAuth";
import { getCategoryFolderId } from "../../lib/estudioCategories";
import { createResumableUploadSession, findOrCreateFolder } from "../../lib/googleDrive";

const MOCKUPS_SUBFOLDER_NAME = "Mockups (Instagram)";
const ORIGINAL_SUBFOLDER_NAME = "Original (Portafolio)";

// Protegido con la misma cookie de sesión que /estudio — evita que
// cualquiera con la URL del endpoint pueda generar sesiones de subida a
// la carpeta de Drive sin haber pasado por la pantalla de contraseña.
async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ESTUDIO_COOKIE_NAME)?.value;
  const expectedToken = getEstudioSessionToken();
  return Boolean(expectedToken) && sessionCookie === expectedToken;
}

// Este endpoint YA NO recibe los bytes de las imágenes (eso causaba
// FUNCTION_PAYLOAD_TOO_LARGE en Vercel con imágenes de alta resolución).
// Solo recibe metadata (nombre + tipo de cada archivo) y devuelve dos
// URLs de sesión de "resumable upload" de Drive — el navegador sube el
// mockup y la imagen de portafolio DIRECTAMENTE a Google con esas URLs,
// sin que el archivo pase por esta función.
export async function POST(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { categoryId, mockup, original } = await request.json().catch(() => ({}));

  if (
    !categoryId ||
    !mockup?.filename ||
    !mockup?.mimeType ||
    !original?.filename ||
    !original?.mimeType
  ) {
    return Response.json({ error: "Datos incompletos" }, { status: 400 });
  }

  // La carpeta de categoría se resuelve SIEMPRE server-side a partir del
  // catálogo conocido (categoryId → folderId) — nunca se confía en un
  // folderId que venga directo del cliente.
  const categoryFolderId = getCategoryFolderId(categoryId);
  if (!categoryFolderId) {
    return Response.json({ error: "Categoría inválida" }, { status: 400 });
  }

  // Origin real del navegador que llamó a este endpoint (fetch() lo manda
  // automáticamente en peticiones POST, sea same-origin o no) — se
  // reenvía a Drive al iniciar cada sesión resumable para que la URL de
  // sesión quede habilitada por CORS para ESE origen exacto. Sin esto,
  // Drive no sabe qué origen autorizar y el PUT directo del navegador
  // falla con un CORS "Failed to fetch" silencioso (ver googleDrive.js).
  const origin = request.headers.get("origin") || new URL(request.url).origin;

  try {
    // Las subcarpetas "Mockups (Instagram)" / "Original (Portafolio)" se
    // buscan por nombre dentro de la carpeta de categoría; si es la
    // primera vez que se sube algo a esa categoría, se crean solas.
    const [mockupsFolderId, originalFolderId] = await Promise.all([
      findOrCreateFolder({ name: MOCKUPS_SUBFOLDER_NAME, parentFolderId: categoryFolderId }),
      findOrCreateFolder({ name: ORIGINAL_SUBFOLDER_NAME, parentFolderId: categoryFolderId }),
    ]);

    const [mockupUploadUrl, originalUploadUrl] = await Promise.all([
      createResumableUploadSession({
        filename: mockup.filename,
        mimeType: mockup.mimeType,
        folderId: mockupsFolderId,
        origin,
      }),
      createResumableUploadSession({
        filename: original.filename,
        mimeType: original.mimeType,
        folderId: originalFolderId,
        origin,
      }),
    ]);

    return Response.json({ ok: true, mockupUploadUrl, originalUploadUrl });
  } catch (err) {
    console.error("[estudio-upload-drive] Falló la creación de la sesión de subida:", err);
    return Response.json({ error: "No se pudo preparar la subida a Drive" }, { status: 502 });
  }
}
