import { google } from "googleapis";
import { Readable } from "stream";

// Server-only: usa stream de Node y credenciales OAuth2, nunca debe
// importarse desde un componente cliente.
//
// Usamos OAuth2 delegado a una cuenta real de Google (no una cuenta de
// servicio): las cuentas de servicio NO tienen cuota de almacenamiento
// propia en Google Drive — solo pueden subir archivos sin límite cuando
// la carpeta destino vive en una Unidad compartida (Shared Drive), una
// función exclusiva de Google Workspace. Como la carpeta de Mystery
// termina viviendo en un Drive personal (Gmail normal), los archivos
// se suben usando la cuota real de esa cuenta vía un refresh token
// obtenido una sola vez (ver scripts/get-google-refresh-token.mjs).
function getOAuthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Faltan GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN en las variables de entorno."
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

function getDriveClient() {
  return google.drive({ version: "v3", auth: getOAuthClient() });
}

// Busca una subcarpeta por NOMBRE dentro de una carpeta padre; si no
// existe, la crea. Así solo hace falta conocer el ID de la carpeta de
// categoría (nivel superior) — las subcarpetas "Mockups (Instagram)" /
// "Original (Portafolio)" se resuelven solas la primera vez que se sube
// algo a cada categoría.
export async function findOrCreateFolder({ name, parentFolderId }) {
  const drive = getDriveClient();

  // Escapa comillas simples dentro del nombre para no romper la query de
  // búsqueda de Drive (usa una sintaxis tipo SQL con comillas simples).
  const escapedName = name.replace(/'/g, "\\'");
  const query = [
    `name='${escapedName}'`,
    `'${parentFolderId}' in parents`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
  ].join(" and ");

  const listRes = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    pageSize: 1,
  });

  const existing = listRes.data.files?.[0];
  if (existing) return existing.id;

  const createRes = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id",
  });

  return createRes.data.id;
}

// Inicia una sesión de "resumable upload" de la API de Drive y devuelve
// la URL de sesión autorizada — el navegador hace el PUT pesado
// DIRECTAMENTE contra esa URL, sin pasar el archivo por nuestra función
// serverless. Esto evita el FUNCTION_PAYLOAD_TOO_LARGE de Vercel con
// imágenes de alta resolución (mockup + portafolio con sangrado), ya que
// el body que sí pasa por nuestro servidor es solo el metadata JSON
// (nombre + carpeta), no los bytes de la imagen.
//
// Flujo (ver https://developers.google.com/workspace/drive/api/guides/manage-uploads#resumable):
// 1. POST a .../upload/drive/v3/files?uploadType=resumable con el
//    metadata (name, parents) y el header X-Upload-Content-Type.
// 2. Drive responde 200 con un header "Location" — esa URL YA lleva la
//    autorización de esta subida específica: el navegador no necesita
//    (ni debe recibir) nuestro access token real para usarla.
// 3. El navegador hace PUT directo del archivo a esa URL de sesión.
//
// CORS: Google decide el Access-Control-Allow-Origin de la URL de sesión
// (paso 3) según el header Origin que haya visto en ESTE POST de inicio
// (paso 1) — no según el Origin que mande el navegador en el PUT
// posterior. Como este POST lo hace nuestro servidor (Node), nunca lleva
// Origin por sí solo, así que Drive no habilitaba CORS para el dominio
// real del navegador y el PUT directo fallaba con "Failed to fetch"
// (bloqueo CORS silencioso, sin respuesta que inspeccionar). El fix es
// reenviar acá el Origin real que trajo la petición del navegador a
// nuestro propio endpoint (ver origin más abajo y route.js).
export async function createResumableUploadSession({ filename, mimeType, folderId, origin }) {
  const oauth2Client = getOAuthClient();
  const { token } = await oauth2Client.getAccessToken();
  if (!token) {
    throw new Error("No se pudo obtener un access token de Google.");
  }

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify({
      name: filename,
      parents: [folderId],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`No se pudo iniciar la subida resumable a Drive (${res.status}): ${text}`);
  }

  const sessionUrl = res.headers.get("location");
  if (!sessionUrl) {
    throw new Error("Drive no devolvió una URL de sesión de subida (header Location ausente).");
  }

  return sessionUrl;
}

// Da permiso "cualquiera con el enlace puede ver" (role: reader, type:
// anyone) a un archivo — necesario para que el link de miniatura
// (https://drive.google.com/thumbnail?id=ID&sz=w1000) sirva la imagen
// públicamente en el sitio sin que cada visitante necesite estar
// autenticado con la cuenta de Google dueña del archivo.
export async function makeFilePublic(fileId) {
  const drive = getDriveClient();
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });
}

// Descarga el contenido de un archivo de Drive usando nuestras propias
// credenciales OAuth2 (server-only) — para el archivo de "Original
// (Portafolio)" de un producto del catálogo, que NUNCA se hace público
// (a diferencia del mockup): solo nuestro servidor puede leerlo, para
// adjuntarlo al correo del fabricante al confirmar una compra.
export async function downloadFileBuffer(fileId) {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data);
}

// Sube un archivo a una carpeta específica de Drive (por su ID) y
// devuelve el id/enlace del archivo creado. El archivo queda de
// propiedad de la cuenta real dueña del refresh token, así que cuenta
// contra su cuota normal — sin necesidad de Unidad compartida.
//
// NOTA: ya no se usa desde /estudio (ver createResumableUploadSession
// arriba) por el límite de payload de Vercel, pero se deja disponible
// por si hace falta subir algo pequeño server-side en el futuro.
export async function uploadFileToDriveFolder({ buffer, filename, mimeType, folderId }) {
  const drive = getDriveClient();

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id, webViewLink",
  });

  return res.data;
}
