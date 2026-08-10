// Borra TODOS los productos de catalog:products en Redis y mueve a la
// papelera (trash, no borrado permanente) los archivos de Drive
// asociados a cada uno (mockup + original crudo + 3 recortes). Uso
// puntual para limpiar productos de prueba — ver conversación.
import { readFileSync } from "fs";
import Redis from "ioredis";
import { google } from "googleapis";

function loadEnvLocal() {
  let raw;
  try {
    raw = readFileSync(".env.local", "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^['"]/, "").replace(/['"]$/, "");
    process.env[match[1].trim()] = value;
  }
}

loadEnvLocal();

if (!process.env.REDIS_URL) {
  console.error("Falta REDIS_URL (revisa .env.local).");
  process.exit(1);
}

const CATALOG_KEY = "catalog:products";

function getDriveClient() {
  const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REFRESH_TOKEN) {
    throw new Error("Faltan credenciales OAuth2 de Google en .env.local.");
  }
  const oauth2Client = new google.auth.OAuth2(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN });
  return google.drive({ version: "v3", auth: oauth2Client });
}

async function trashFile(drive, fileId, label) {
  if (!fileId) return;
  try {
    await drive.files.update({ fileId, requestBody: { trashed: true } });
    console.log(`  ✔ ${label}: ${fileId}`);
  } catch (err) {
    console.error(`  ✗ ${label}: ${fileId} — ${err.message}`);
  }
}

const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000 });

try {
  const raw = await redis.lrange(CATALOG_KEY, 0, -1);
  const products = raw
    .map((entry) => {
      try {
        return JSON.parse(entry);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  console.log(`Productos a borrar: ${products.length}\n`);

  const drive = getDriveClient();

  for (const p of products) {
    console.log(`Producto ${p.id} (categoría: ${p.category})`);
    await trashFile(drive, p.mockupFileId, "mockup");
    await trashFile(drive, p.originalRawFileId, "originalRaw");
    if (p.printFileIds) {
      for (const [sizeId, fileId] of Object.entries(p.printFileIds)) {
        await trashFile(drive, fileId, `print_${sizeId}`);
      }
    }
    // Compatibilidad con el modelo viejo, por si quedó alguno sin migrar.
    await trashFile(drive, p.originalFileId, "originalFileId (modelo viejo)");
    console.log("");
  }

  await redis.del(CATALOG_KEY);
  console.log(`Listo: catalog:products vaciado (${products.length} producto(s) borrados) y archivos movidos a la papelera de Drive.`);
} finally {
  redis.disconnect();
}
