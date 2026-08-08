import { cookies } from "next/headers";
import { ESTUDIO_COOKIE_NAME, getEstudioSessionToken } from "../../lib/estudioAuth";
import { getCategoryFolderId } from "../../lib/estudioCategories";
import { uploadFileToDriveFolder } from "../../lib/googleDrive";

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

  const { imageBase64, filename, categoryId } = await request.json().catch(() => ({}));
  if (!imageBase64 || !filename || !categoryId) {
    return Response.json({ error: "Datos incompletos" }, { status: 400 });
  }

  // La carpeta destino se resuelve SIEMPRE server-side a partir del
  // catálogo conocido (categoryId → folderId) — nunca se confía en un
  // folderId que venga directo del cliente.
  const folderId = getCategoryFolderId(categoryId);
  if (!folderId) {
    return Response.json({ error: "Categoría inválida" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(imageBase64, "base64");
    const file = await uploadFileToDriveFolder({
      buffer,
      filename,
      mimeType: "image/png",
      folderId,
    });
    return Response.json({ ok: true, fileId: file.id, webViewLink: file.webViewLink });
  } catch (err) {
    console.error("[estudio-upload-drive] Falló la subida a Drive:", err);
    return Response.json({ error: "No se pudo subir el archivo a Drive" }, { status: 502 });
  }
}
