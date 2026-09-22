import sharp from "sharp";

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
// IMPORTANTE — densidad física: el archivo que genera cropImage.js
// (getCroppedImageWithBleed) incrusta la densidad real (px/cm) en los
// bytes del JPEG/PNG, para que cualquier software (Photoshop, etc.)
// muestre el tamaño físico correcto (tamaño vendido + 1cm de sangrado
// a izquierda, derecha y abajo; sin sangrado arriba) sin importar cuántos píxeles tenga el archivo. Replicate
// devuelve un PNG nuevo SIN esa metadata (density genérica o ausente) —
// si no se reinserta, el archivo mejorado pierde el dato de "a qué
// tamaño físico corresponde" y se abre mal (se ve más chico de lo que
// debería). Por eso acá se recalcula la densidad con los píxeles
// finales reales y el tamaño físico conocido (physicalWidthCm), y se
// reinserta con sharp antes de devolver el resultado.
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
// terminar, se cae al sondeo de respaldo de abajo.
const SYNC_WAIT_SECONDS = 55;
const MAX_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 3000;

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  return match ? { mimeType: match[1], base64: match[2] } : null;
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

// scaleFactor se calcula para que la imagen resultante alcance AL MENOS
// targetWidth x targetHeight (el mínimo de píxeles del tamaño comprado,
// ver SIZES.minWidth/minHeight en order.js — la misma densidad de
// ~40px/cm que ya usa needsAiUpscale). Si la foto ya viene en resolución
// suficiente, no se manda a Replicate — evita gastar y perder tiempo sin
// necesidad. El factor final se redondea un poco hacia arriba (margen de
// 10%) para no quedar justo al límite, y nunca baja de 1 ni sube de 10
// (Replicate acepta hasta 100x, pero no hace falta tanto acá).
function computeScaleFactor(width, height, targetWidth, targetHeight) {
  if (!targetWidth || !targetHeight || !width || !height) return 2;
  const neededScale = Math.max(targetWidth / width, targetHeight / height);
  if (neededScale <= 1) return 1;
  return Math.min(Math.ceil(neededScale * 1.1 * 10) / 10, 10);
}

export async function upscaleImageDataUrl(
  dataUrl,
  { targetWidth, targetHeight, physicalWidthCm } = {}
) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return dataUrl;

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return dataUrl;

  const inputBuffer = Buffer.from(parsed.base64, "base64");

  let inputMeta;
  try {
    inputMeta = await sharp(inputBuffer).metadata();
  } catch (err) {
    console.error("[upscaleImage] No se pudo leer las dimensiones de la foto:", err);
    return dataUrl;
  }

  const scaleFactor = computeScaleFactor(
    inputMeta.width,
    inputMeta.height,
    targetWidth,
    targetHeight
  );

  // Ya está en resolución suficiente — no hace falta llamar a Replicate.
  if (scaleFactor <= 1) return dataUrl;

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
    let outBuffer = Buffer.from(await imgRes.arrayBuffer());
    let contentType = imgRes.headers.get("content-type") || "image/png";

    // Reinserta la densidad física correcta (ver comentario grande
    // arriba) — sin esto, el archivo mejorado pierde el dato de a qué
    // tamaño físico corresponde y se abre más chico de lo debido.
    if (physicalWidthCm) {
      try {
        const outMeta = await sharp(outBuffer).metadata();
        if (outMeta.width) {
          const pxPerCm = outMeta.width / physicalWidthCm;
          const densityDpi = Math.round(pxPerCm * 2.54);
          outBuffer = await sharp(outBuffer).withMetadata({ density: densityDpi }).png().toBuffer();
          contentType = "image/png";
        }
      } catch (err) {
        console.error(
          "[upscaleImage] No se pudo reinsertar la densidad física — el archivo mejorado puede abrirse a un tamaño incorrecto:",
          err
        );
      }
    }

    return `data:${contentType};base64,${outBuffer.toString("base64")}`;
  } catch (err) {
    console.error("[upscaleImage] Error inesperado mejorando la imagen:", err);
    return dataUrl;
  }
}
