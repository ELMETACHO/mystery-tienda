import { google } from "googleapis";

// Server-only. Mismo patrón OAuth2 delegado que app/lib/googleDrive.js —
// reutiliza el mismo refresh token, ahora con scope ampliado
// (https://www.googleapis.com/auth/spreadsheets, ver
// scripts/get-google-refresh-token.mjs) para poder leer/escribir en el
// spreadsheet de finanzas/CRM (ver scripts/create-finance-sheet.mjs).
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

function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getOAuthClient() });
}

// Agrega una fila al final de una pestaña y devuelve el número de fila
// real donde quedó (parseado de updatedRange, ej. "Fabricante!A5:F5" ->
// 5) — necesario para poder actualizar esa misma fila más adelante (ver
// updateCell) sin tener que volver a buscarla por contenido.
export async function appendRow({ spreadsheetId, sheetName, values }) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });

  const updatedRange = res.data.updates?.updatedRange || "";
  const match = updatedRange.match(/!A(\d+)/);
  return match ? Number(match[1]) : null;
}

// Actualiza una sola celda (columna+fila) — usado para pasar el Estado
// de "Pendiente" a "Pagado" en la pestaña Fabricante sin tocar el resto
// de la fila ni borrar historial.
export async function updateCell({ spreadsheetId, sheetName, column, row, value }) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!${column}${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });
}
