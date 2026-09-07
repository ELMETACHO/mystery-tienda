// Rellena name/description (título y descripción cortos generados por IA
// a partir del mockup, ver app/lib/aiProductText.js) en productos de
// catalog:products que se subieron ANTES de que existiera esa generación
// automática en /estudio — o donde falló en su momento.
//
// Solo toca productos con name/description vacíos (nunca pisa texto ya
// generado). Recorre uno por uno con una pausa entre llamadas para no
// saturar ni la API de Anthropic ni las miniaturas de Drive; si un
// producto falla, lo reporta y sigue con el siguiente (no aborta el lote
// completo por un solo error de red).
//
// Uso: node --env-file=.env.local scripts/backfill-product-text.mjs
import { readFileSync } from "fs";
import Redis from "ioredis";

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
    if (!process.env[match[1].trim()]) {
      process.env[match[1].trim()] = value;
    }
  }
}

loadEnvLocal();

if (!process.env.REDIS_URL) {
  console.error("Falta REDIS_URL (revisa .env.local).");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Falta ANTHROPIC_API_KEY (revisa .env.local).");
  process.exit(1);
}

const CATALOG_KEY = "catalog:products";
const DELAY_MS = 1200; // pausa entre productos — nada de rate-limit conocido, es solo prudencia.
const MODEL = "claude-haiku-4-5-20251001";

const PROMPT = `Estás ayudando a una tienda colombiana de cuadros personalizados en vinilo sobre madera. Te muestro la imagen de un diseño (puede tener un fondo de pared/sillón de referencia alrededor, ignóralo — describe solo el diseño/arte central).

Devuelve SOLO un JSON válido, sin texto adicional, con este formato exacto:
{"name": "...", "description": "..."}

- "name": título corto (máximo 6 palabras) que identifique lo que se ve (personaje, escena, artista, equipo, etc). No repitas la palabra "cuadro". Ejemplo: "Luffy y Zoro en Wano".
- "description": una sola frase (máximo 25 palabras) describiendo el diseño para un cliente que está comprando el cuadro. No inventes datos que no se vean en la imagen.`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateProductText(imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`No se pudo descargar la miniatura (${res.status})`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mediaType = contentType.split(";")[0];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic respondió ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const text = data?.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Respuesta sin bloque de texto");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No se encontró JSON en la respuesta: ${text}`);

  const parsed = JSON.parse(jsonMatch[0]);
  const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
  const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
  if (!name || !description) throw new Error(`JSON incompleto: ${text}`);

  return { name, description };
}

const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000 });

try {
  const raw = await redis.lrange(CATALOG_KEY, 0, -1);
  const products = raw
    .map((entry, index) => {
      try {
        return { index, ...JSON.parse(entry) };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const pending = products.filter((p) => !p.name || !p.description);

  console.log(`Total productos: ${products.length} — pendientes de texto: ${pending.length}\n`);

  let done = 0;
  let failed = 0;

  for (const product of pending) {
    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${product.mockupFileId}&sz=w500`;
    try {
      const { name, description } = await generateProductText(thumbnailUrl);

      // Re-lee el índice actual antes de escribir: entre el inicio del
      // script y esta escritura pudo haberse subido/borrado algo más en
      // /estudio y correrse los índices de la lista.
      const currentRaw = await redis.lrange(CATALOG_KEY, 0, -1);
      const currentIndex = currentRaw.findIndex((entry) => {
        try {
          return JSON.parse(entry).id === product.id;
        } catch {
          return false;
        }
      });

      if (currentIndex === -1) {
        console.log(`⚠ [${product.id}] ya no existe en el catálogo, se omite.`);
        continue;
      }

      const current = JSON.parse(currentRaw[currentIndex]);
      current.name = name;
      current.description = description;
      await redis.lset(CATALOG_KEY, currentIndex, JSON.stringify(current));

      done += 1;
      console.log(`✅ [${product.id}] "${name}" — ${description}`);
    } catch (err) {
      failed += 1;
      console.error(`❌ [${product.id}] falló:`, err.message);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nListo. ${done} actualizados, ${failed} fallidos de ${pending.length} pendientes.`);
} finally {
  redis.disconnect();
}
