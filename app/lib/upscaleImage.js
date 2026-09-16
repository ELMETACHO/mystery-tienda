// Mejora de resolución con IA (Replicate, modelo philz1337x/crystal-upscaler
// — optimizado para retratos/fotos reales, justo el caso de las fotos que
// suben los clientes en /crear) para la foto de impresión final ANTES de
// que llegue al correo del fabricante. Reemplaza el flujo manual anterior
// (Magnific, subido a mano por pedido — ver CLAUDE.md).
//
// Solo aplica a pedidos de /crear (foto propia del cliente) — los
// productos del catálogo (/estudio) ya vienen en alta resolución desde el
// diseñador, así que confirmApprovedOrder.js/confirmApprovedCodOrder.js
// solo llaman a esto cuando processCatalogProductPurchase no devolvió un
// archivo de catálogo.
//
// Nunca lanza ni bloquea la confirmación del pedido: si Replicate no está
// configurado (falta REPLICATE_API_TOKEN), tarda demasiado, o falla por
// cualquier motivo, se sigue con la imagen original tal cual. El cliente
// ya pagó y el pedido ya está confirmado — un problema acá nunca debe
// impedir que le llegue su cuadro, solo que se pierda la mejora de
// calidad esta vez.

const REPLICATE_MODEL = "philz1337x/crystal-upscaler";

// Prefer: wait=55 le pide a Replicate que responda de forma síncrona si
// termina dentro de ese tiempo (máximo permitido: 60s) — evita el vaivén
// de sondeo manual en el caso normal. Si de todas formas no alcanza a
// terminar, se cae al sondeo de respaldo de abajo (hasta ~30s más).
const SYNC_WAIT_SECONDS = 55;
const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 3000;

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  return match ? { mimeType: match[1] } : null;
}

async function pollUntilDone(predictionUrl, token) {
  if (!predictionUrl) return null;
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const res = await fetch(predictionUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) continue;
    const data = await res.json();
    if (["succeeded", "failed", "canceled"].includes(data.status)) {
      return data;
    }
  }
  return null;
}

export async function upscaleImageDataUrl(dataUrl, { scaleFactor = 2 } = {}) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return dataUrl;
  if (!parseDataUrl(dataUrl)) return dataUrl;

  try {
    const createRes = await fetch(
      `https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: `wait=${SYNC_WAIT_SECONDS}`,
        },
        body: JSON.stringify({
          input: { image: dataUrl, scale_factor: scaleFactor },
        }),
      }
    );

    if (!createRes.ok) {
      console.error(
        "[upscaleImage] Replicate respondió con error al crear la predicción:",
        createRes.status,
        await createRes.text().catch(() => "")
      );
      return dataUrl;
    }

    let prediction = await createRes.json();

    if (!["succeeded", "failed", "canceled"].includes(prediction.status)) {
      prediction = (await pollUntilDone(prediction.urls?.get, token)) || prediction;
    }

    if (prediction.status !== "succeeded" || !prediction.output) {
      console.error(
        "[upscaleImage] La predicción no terminó en éxito:",
        prediction.status,
        prediction.error
      );
      return dataUrl;
    }

    const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    const imgRes = await fetch(outputUrl);
    if (!imgRes.ok) {
      console.error("[upscaleImage] No se pudo descargar la imagen mejorada:", imgRes.status);
      return dataUrl;
    }
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const contentType = imgRes.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.error("[upscaleImage] Error inesperado mejorando la imagen:", err);
    return dataUrl;
  }
}
