import { cookies } from "next/headers";
import { ESTUDIO_COOKIE_NAME, getEstudioSessionToken } from "../../lib/estudioAuth";
import { getCategoryFolderId } from "../../lib/estudioCategories";
import { findOrCreateFolder, uploadFileToDriveFolder } from "../../lib/googleDrive";

const MOCKUPS_SUBFOLDER_NAME = "Mockups (Instagram)";
const ORIGINAL_SUBFOLDER_NAME = "Original (Portafolio)";

// Protegido con la misma cookie de sesión que /estudio — evita que
// cualquiera con la URL del endpoint pueda subir archivos a la carpeta
// de Drive sin haber pasado por la pantalla de contraseña.
async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ESTUDIO_COOKIE_NAME)?.value;
  const expectedToken = getEstudioSessionToken();
  return Boolean(expectedToken) && sessionCookie === expectedToken;
}

export async function POST(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const {
    imageBase64, // mockup compuesto (diseño + fondo)
    filename, // nombre del mockup
    originalImageBase64, // imagen original tal cual la subió el diseñador
    originalFilename,
    originalMimeType,
    categoryId,
  } = await request.json().catch(() => ({}));

  if (
    !imageBase64 ||
    !filename ||
    !categoryId ||
    !originalImageBase64 ||
    !originalFilename ||
    !originalMimeType
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

  try {
    // Las subcarpetas "Mockups (Instagram)" / "Original (Portafolio)" se
    // buscan por nombre dentro de la carpeta de categoría; si es la
    // primera vez que se sube algo a esa categoría, se crean solas.
    const [mockupsFolderId, originalFolderId] = await Promise.all([
      findOrCreateFolder({ name: MOCKUPS_SUBFOLDER_NAME, parentFolderId: categoryFolderId }),
      findOrCreateFolder({ name: ORIGINAL_SUBFOLDER_NAME, parentFolderId: categoryFolderId }),
    ]);

    const [mockupFile, originalFile] = await Promise.all([
      uploadFileToDriveFolder({
        buffer: Buffer.from(imageBase64, "base64"),
        filename,
        mimeType: "image/png",
        folderId: mockupsFolderId,
      }),
      // Imagen original SIN recomprimir: el buffer viene directo del
      // dataURL que generó el navegador al leer el archivo original
      // (FileReader.readAsDataURL), que preserva los bytes tal cual los
      // subió el diseñador — no pasa por el <canvas> del mockup.
      uploadFileToDriveFolder({
        buffer: Buffer.from(originalImageBase64, "base64"),
        filename: originalFilename,
        mimeType: originalMimeType,
        folderId: originalFolderId,
      }),
    ]);

    return Response.json({
      ok: true,
      mockup: { fileId: mockupFile.id, webViewLink: mockupFile.webViewLink },
      original: { fileId: originalFile.id, webViewLink: originalFile.webViewLink },
    });
  } catch (err) {
    console.error("[estudio-upload-drive] Falló la subida a Drive:", err);
    return Response.json({ error: "No se pudo subir el archivo a Drive" }, { status: 502 });
  }
}
