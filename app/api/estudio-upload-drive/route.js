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
// Solo recibe metadata (nombre + tipo de cada archivo) y devuelve una URL
// de sesión de "resumable upload" de Drive por archivo — el navegador
// sube cada archivo DIRECTAMENTE a Google con esas URLs, sin que pase
// por esta función.
//
// `files` es una lista de { key, filename, mimeType, folder } — `key` es
// un identificador arbitrario que el cliente elige para poder mapear la
// URL de sesión devuelta a cada archivo (ej. "mockup", "originalRaw",
// "print_30x40", "print_40x50", "print_50x70"). `folder` selecciona en
// qué subcarpeta de la categoría sube ese archivo ("mockups" u
// "original"); todo lo que no sea mockup (el original crudo y los 3
// recortes horneados) vive en "Original (Portafolio)".
export async function POST(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { categoryId, files } = await request.json().catch(() => ({}));

  if (
    !categoryId ||
    !Array.isArray(files) ||
    files.length === 0 ||
    files.some((f) => !f?.key || !f?.filename || !f?.mimeType)
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

    const uploadUrls = {};
    await Promise.all(
      files.map(async (file) => {
        const folderId = file.folder === "mockups" ? mockupsFolderId : originalFolderId;
        uploadUrls[file.key] = await createResumableUploadSession({
          filename: file.filename,
          mimeType: file.mimeType,
          folderId,
          origin,
        });
      })
    );

    return Response.json({ ok: true, uploadUrls });
  } catch (err) {
    console.error("[estudio-upload-drive] Falló la creación de la sesión de subida:", err);
    return Response.json({ error: "No se pudo preparar la subida a Drive" }, { status: 502 });
  }
}
