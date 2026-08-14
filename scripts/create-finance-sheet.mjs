// Script de UN SOLO USO: crea el Google Sheet de finanzas con el
// fabricante + CRM (pestañas "Fabricante" y "CRM"), con estilo morado
// de marca. Requiere que .env.local ya tenga GOOGLE_OAUTH_REFRESH_TOKEN
// con el scope https://www.googleapis.com/auth/spreadsheets (ver
// scripts/get-google-refresh-token.mjs) — sin eso falla con un error de
// permisos.
//
// CÓMO USARLO:
//   node scripts/create-finance-sheet.mjs
//
// Al final imprime el ID del spreadsheet — agrégalo a .env.local como
// GOOGLE_SHEETS_FINANCE_ID (y luego a Vercel antes de desplegar).

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
const REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error(
    "Faltan GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN en .env.local."
  );
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
const sheets = google.sheets({ version: "v4", auth: oauth2Client });

// Acento morado de la marca (--accent: #a855f7).
const PURPLE = { red: 168 / 255, green: 85 / 255, blue: 247 / 255 };
const WHITE = { red: 1, green: 1, blue: 1 };

const FABRICANTE_HEADERS = [
  "Cliente",
  "Ciudad",
  "Tamaño",
  "Monto adeudado",
  "Fecha",
  "Estado",
  // Link de la guía de Skydropx generada — segunda forma de validación
  // manual junto al Estado (ver app/lib/manufacturerFinance.js). La
  // fila solo se crea DESPUÉS de que existe esta guía real, así que
  // este campo siempre viene lleno (nunca queda "Pendiente" sin guía).
  "Guía",
];
const CRM_HEADERS = [
  "Nombre",
  "Teléfono",
  "Dirección",
  "Correo",
  "Tamaño",
  "Método de pago",
  "Cupón/Referido usado",
  "Fecha",
  "Total histórico de compras",
];

async function main() {
  console.log("Creando spreadsheet...");
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: "Mystery — Finanzas y CRM" },
      sheets: [
        {
          properties: {
            title: "Fabricante",
            tabColor: PURPLE,
            gridProperties: { frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: "CRM",
            tabColor: PURPLE,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    },
  });

  const spreadsheetId = createRes.data.spreadsheetId;
  const sheetIdByTitle = {};
  for (const s of createRes.data.sheets) {
    sheetIdByTitle[s.properties.title] = s.properties.sheetId;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Fabricante!A1",
    valueInputOption: "RAW",
    requestBody: { values: [FABRICANTE_HEADERS] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "CRM!A1",
    valueInputOption: "RAW",
    requestBody: { values: [CRM_HEADERS] },
  });

  // Encabezados con fondo morado y texto blanco en negrita, en ambas
  // pestañas — mismo tono de acento que el resto del sitio.
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: ["Fabricante", "CRM"].map((title) => ({
        repeatCell: {
          range: {
            sheetId: sheetIdByTitle[title],
            startRowIndex: 0,
            endRowIndex: 1,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: PURPLE,
              textFormat: { bold: true, foregroundColor: WHITE },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat)",
        },
      })),
    },
  });

  console.log("\n✅ Spreadsheet creado.\n");
  console.log(`ID: ${spreadsheetId}`);
  console.log(`URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}\n`);
  console.log("Agrega esta línea a .env.local:\n");
  console.log(`GOOGLE_SHEETS_FINANCE_ID=${spreadsheetId}\n`);
}

main().catch((err) => {
  console.error("Error creando el spreadsheet:", err.message);
  process.exit(1);
});
