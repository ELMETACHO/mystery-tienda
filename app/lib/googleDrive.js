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

// Sube un archivo a una carpeta específica de Drive (por su ID) y
// devuelve el id/enlace del archivo creado. El archivo queda de
// propiedad de la cuenta real dueña del refresh token, así que cuenta
// contra su cuota normal — sin necesidad de Unidad compartida.
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
