// Script de UN SOLO USO para obtener el refresh_token de OAuth2 de tu
// cuenta real de Google (oscarmetacho@gmail.com), necesario porque las
// cuentas de servicio no tienen cuota propia en Drive personal.
//
// CÓMO USARLO:
// 1. En Google Cloud Console (proyecto "mystery-drive-integration"):
//    APIs y servicios > Credenciales > Crear credenciales >
//    ID de cliente de OAuth > tipo "Aplicación web".
//    En "URIs de redireccionamiento autorizados" agrega exactamente:
//      http://localhost:8888/oauth2callback
// 2. Copia el Client ID y Client Secret que te da Google y agrégalos a
//    .env.local:
//      GOOGLE_OAUTH_CLIENT_ID=...
//      GOOGLE_OAUTH_CLIENT_SECRET=...
// 3. Corre este script: node scripts/get-google-refresh-token.mjs
// 4. Se abre (o te muestra) una URL — ábrela en tu navegador, inicia
//    sesión con oscarmetacho@gmail.com, y acepta el permiso.
// 5. El script captura la respuesta automáticamente y imprime el
//    refresh_token — cópialo a .env.local como GOOGLE_OAUTH_REFRESH_TOKEN.
// 6. Puedes borrar este script o dejarlo (no expone nada sensible por sí
//    solo, solo automatiza el intercambio).

import http from "http";
import { google } from "googleapis";
import fs from "fs";

const ENV_PATH = new URL("../.env.local", import.meta.url);

function loadEnvLocal() {
  const raw = fs.readFileSync(ENV_PATH, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvLocal();

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:8888/oauth2callback";
const PORT = 8888;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Faltan GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET en .env.local — sigue el paso 1-2 de las instrucciones arriba de este archivo."
  );
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // fuerza a que SIEMPRE devuelva refresh_token, no solo la primera vez.
  scope: [
    "https://www.googleapis.com/auth/drive.file",
    // Agregado para el sistema de finanzas/CRM en Google Sheets (panel
    // /admin): un refresh_token queda fijo a los scopes con los que se
    // generó, así que agregar este scope obliga a repetir esta
    // autorización una vez — no basta con solo agregarlo aquí.
    "https://www.googleapis.com/auth/spreadsheets",
  ],
});

console.log("\nAbre esta URL en tu navegador e inicia sesión con oscarmetacho@gmail.com:\n");
console.log(authUrl);
console.log("\nEsperando la autorización...\n");

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith("/oauth2callback")) {
    res.writeHead(404);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get("code");

  if (!code) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Falta el parámetro 'code' en la respuesta de Google.");
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Listo, ya puedes cerrar esta pestaña y volver a la terminal.");

    console.log("\n✅ Autorización exitosa.\n");
    if (tokens.refresh_token) {
      console.log("Agrega esta línea a .env.local:\n");
      console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    } else {
      console.log(
        "⚠️ Google no devolvió refresh_token esta vez (puede pasar si ya habías autorizado antes). Ve a https://myaccount.google.com/permissions, quita el acceso de esta app, y vuelve a correr este script."
      );
    }
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Error obteniendo el token — revisa la terminal.");
    console.error("Error intercambiando el código por tokens:", err.message);
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log(`(Servidor local esperando en http://localhost:${PORT} ...)`);
});
