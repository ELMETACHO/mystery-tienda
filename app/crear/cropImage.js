// Recorte centrado que cubre el aspecto del marco, usado como respaldo cuando
// react-easy-crop todavía no emitió un croppedAreaPixels (p. ej. si el usuario
// nunca interactuó con el tamaño por defecto antes de continuar).
export function getDefaultCropArea({ width, height }, aspect) {
  const imageAspect = width / height;
  const cropWidth = imageAspect > aspect ? height * aspect : width;
  const cropHeight = imageAspect > aspect ? height : width / aspect;

  return {
    x: (width - cropWidth) / 2,
    y: (height - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}

// Genera la imagen recortada final a partir del área seleccionada en
// react-easy-crop. `format` = "png" (por defecto, sin pérdida — usado por
// /estudio para los archivos maestros del catálogo) o "jpeg" (usado por
// /crear: una foto de celular en PNG sin comprimir puede pesar 10-20MB, muy
// por encima del límite de payload de ~4.5MB de las funciones serverless
// de Vercel — ver CLAUDE.md — así que el pedido del cliente viaja como
// JPEG comprimido en vez de PNG).
export function getCroppedImage(imageSrc, croppedAreaPixels, format = "png") {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      canvasToDataUrlWithDensity(canvas, null, format).then(resolve, reject);
    };
    image.onerror = reject;
  });
}

// Dibuja `image` recortando el rectángulo `srcRect` (en coordenadas de la
// imagen original, que puede sobresalir de sus límites) dentro de un canvas
// del tamaño de `srcRect`. Donde el rectángulo se sale del área real de la
// imagen, extiende el último píxel disponible (edge clamp) en vez de dejar
// transparencia — parte central 1:1 + hasta 8 franjas/esquinas de borde
// estiradas a partir de una tira de 1px del borde real.
function drawWithEdgeClamp(ctx, image, srcRect) {
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;

  const srcLeft = Math.max(0, srcRect.x);
  const srcTop = Math.max(0, srcRect.y);
  const srcRight = Math.min(naturalWidth, srcRect.x + srcRect.width);
  const srcBottom = Math.min(naturalHeight, srcRect.y + srcRect.height);

  const overlapWidth = Math.max(0, srcRight - srcLeft);
  const overlapHeight = Math.max(0, srcBottom - srcTop);

  const destX = srcLeft - srcRect.x;
  const destY = srcTop - srcRect.y;

  const leftMargin = Math.max(0, -srcRect.x);
  const topMargin = Math.max(0, -srcRect.y);
  const rightMargin = Math.max(0, srcRect.x + srcRect.width - naturalWidth);
  const bottomMargin = Math.max(0, srcRect.y + srcRect.height - naturalHeight);

  if (overlapWidth <= 0 || overlapHeight <= 0) {
    // El recorte quedó completamente fuera de la imagen (no debería pasar
    // en uso normal): no hay nada real que dibujar ni de qué borde clonar.
    return;
  }

  // Centro: 1:1, sin escalar.
  ctx.drawImage(
    image,
    srcLeft,
    srcTop,
    overlapWidth,
    overlapHeight,
    destX,
    destY,
    overlapWidth,
    overlapHeight
  );

  // Franjas de borde (izquierda/derecha/arriba/abajo): 1px del borde real,
  // estirado para rellenar el margen que se salía de la imagen.
  if (leftMargin > 0) {
    ctx.drawImage(image, srcLeft, srcTop, 1, overlapHeight, 0, destY, leftMargin, overlapHeight);
  }
  if (rightMargin > 0) {
    ctx.drawImage(
      image,
      srcRight - 1,
      srcTop,
      1,
      overlapHeight,
      destX + overlapWidth,
      destY,
      rightMargin,
      overlapHeight
    );
  }
  if (topMargin > 0) {
    ctx.drawImage(image, srcLeft, srcTop, overlapWidth, 1, destX, 0, overlapWidth, topMargin);
  }
  if (bottomMargin > 0) {
    ctx.drawImage(
      image,
      srcLeft,
      srcBottom - 1,
      overlapWidth,
      1,
      destX,
      destY + overlapHeight,
      overlapWidth,
      bottomMargin
    );
  }

  // Esquinas: 1 píxel de la esquina real, estirado al rectángulo de esquina.
  if (leftMargin > 0 && topMargin > 0) {
    ctx.drawImage(image, srcLeft, srcTop, 1, 1, 0, 0, leftMargin, topMargin);
  }
  if (rightMargin > 0 && topMargin > 0) {
    ctx.drawImage(image, srcRight - 1, srcTop, 1, 1, destX + overlapWidth, 0, rightMargin, topMargin);
  }
  if (leftMargin > 0 && bottomMargin > 0) {
    ctx.drawImage(image, srcLeft, srcBottom - 1, 1, 1, 0, destY + overlapHeight, leftMargin, bottomMargin);
  }
  if (rightMargin > 0 && bottomMargin > 0) {
    ctx.drawImage(
      image,
      srcRight - 1,
      srcBottom - 1,
      1,
      1,
      destX + overlapWidth,
      destY + overlapHeight,
      rightMargin,
      bottomMargin
    );
  }
}

// --- Densidad física (chunk pHYs de PNG) ---------------------------------
//
// canvas.toDataURL()/toBlob() nunca escriben metadata de DPI/densidad — el
// <canvas> no tiene concepto de tamaño físico, solo píxeles. Software
// como Illustrator, al no encontrarla, asume 72 DPI por defecto y muestra
// un tamaño físico incorrecto al abrir el archivo (aunque los píxeles en
// sí ya son los correctos para imprimir en el tamaño real). Para que el
// PNG declare su densidad real, hay que insertar a mano el chunk
// estándar de PNG para esto: `pHYs` (9 bytes: píxeles por unidad en X,
// píxeles por unidad en Y, y un byte de unidad — 1 = metro), justo
// después del chunk `IHDR` (única posición válida para este chunk).

// CRC32 estándar (usado por todos los chunks de PNG) — tabla calculada
// una sola vez y cacheada.
let pngCrcTable = null;
function getPngCrcTable() {
  if (pngCrcTable) return pngCrcTable;
  pngCrcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    pngCrcTable[n] = c;
  }
  return pngCrcTable;
}

function pngCrc32(bytes) {
  const table = getPngCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Inserta el chunk pHYs justo después de IHDR (8 bytes de firma + 4 de
// longitud + 4 de tipo + 13 de datos + 4 de CRC = 33 bytes fijos al
// inicio de cualquier PNG). pixelsPerMeter se aplica igual en X e Y —
// el sangrado/recorte no distingue densidad horizontal de vertical.
function insertPngPhysChunk(pngBytes, pixelsPerMeter) {
  const IHDR_CHUNK_END = 8 + 4 + 4 + 13 + 4;

  const physData = new Uint8Array(9);
  const physView = new DataView(physData.buffer);
  physView.setUint32(0, pixelsPerMeter, false);
  physView.setUint32(4, pixelsPerMeter, false);
  physData[8] = 1; // unidad: metro

  const typeBytes = new Uint8Array([0x70, 0x48, 0x59, 0x73]); // "pHYs"
  const crcInput = new Uint8Array(typeBytes.length + physData.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(physData, typeBytes.length);
  const crc = pngCrc32(crcInput);

  const chunk = new Uint8Array(4 + typeBytes.length + physData.length + 4);
  const chunkView = new DataView(chunk.buffer);
  chunkView.setUint32(0, physData.length, false);
  chunk.set(typeBytes, 4);
  chunk.set(physData, 8);
  chunkView.setUint32(chunk.length - 4, crc, false);

  const result = new Uint8Array(pngBytes.length + chunk.length);
  result.set(pngBytes.subarray(0, IHDR_CHUNK_END), 0);
  result.set(chunk, IHDR_CHUNK_END);
  result.set(pngBytes.subarray(IHDR_CHUNK_END), IHDR_CHUNK_END + chunk.length);
  return result;
}

// Calidad JPEG para /crear: visualmente indistinguible del original para
// impresión en vinilo sobre madera (no es impresión de arte fino) y
// reduce el tamaño del archivo entre 5-15x frente al PNG sin comprimir —
// una foto de iPhone de 10-20MB en PNG normalmente baja a 1-3MB en JPEG a
// esta calidad, muy por debajo del límite de payload de Vercel.
const JPEG_QUALITY = 0.85;

// --- Densidad física en JPEG (segmento APP0/JFIF) ------------------------
//
// A diferencia del PNG (que no reserva espacio para densidad y hay que
// insertar un chunk nuevo, ver insertPngPhysChunk arriba), todo JPEG que
// sale de canvas.toBlob ya incluye un segmento APP0 JFIF con campos de
// densidad reservados (por defecto "sin unidades") — solo hace falta
// sobrescribir esos bytes existentes, sin insertar nada ni recalcular
// checksums (JFIF no usa CRC). Estructura del segmento (offsets desde el
// inicio del archivo): 0-1 SOI (FFD8), 2-3 marcador APP0 (FFE0), 4-5
// longitud, 6-9 "JFIF", 10 terminador nulo, 11-12 versión, 13 unidad,
// 14-15 densidad X, 16-17 densidad Y.
function insertJpegDensity(jpegBytes, pxPerCm) {
  const isJpeg = jpegBytes[0] === 0xff && jpegBytes[1] === 0xd8;
  const hasApp0 = jpegBytes[2] === 0xff && jpegBytes[3] === 0xe0;
  const identifier = hasApp0
    ? String.fromCharCode(jpegBytes[6], jpegBytes[7], jpegBytes[8], jpegBytes[9])
    : "";

  if (!isJpeg || !hasApp0 || identifier !== "JFIF") {
    // No se pudo encontrar el segmento esperado (encoder distinto al
    // habitual) — se devuelve el JPEG intacto, sin densidad embebida, en
    // vez de fallar: los píxeles reales (lo único que importa para
    // imprimir en el tamaño correcto) siguen siendo los correctos.
    return jpegBytes;
  }

  const view = new DataView(jpegBytes.buffer, jpegBytes.byteOffset, jpegBytes.byteLength);
  const pixelsPerCm = Math.round(pxPerCm);
  view.setUint8(13, 2); // unidad: 2 = píxeles por centímetro
  view.setUint16(14, pixelsPerCm, false);
  view.setUint16(16, pixelsPerCm, false);
  return jpegBytes;
}

// Codifica el canvas al `format` pedido y, si se conoce pxPerCm, le
// inyecta la densidad física correspondiente antes de devolver el dataURL
// final. Sin pxPerCm (llamadas que no necesitan densidad física), se
// comporta igual que un toDataURL plano, sin metadata.
function canvasToDataUrlWithDensity(canvas, pxPerCm, format = "png") {
  if (format === "png") {
    return new Promise((resolve, reject) => {
      if (!pxPerCm) {
        resolve(canvas.toDataURL("image/png"));
        return;
      }

      canvas.toBlob(async (blob) => {
        if (!blob) {
          reject(new Error("No se pudo generar el PNG."));
          return;
        }
        try {
          const arrayBuffer = await blob.arrayBuffer();
          // px/cm × 100 = px/metro — conversión directa, sin pasar por
          // pulgadas/DPI (pHYs guarda píxeles por metro, no por pulgada).
          const pixelsPerMeter = Math.round(pxPerCm * 100);
          const withPhys = insertPngPhysChunk(new Uint8Array(arrayBuffer), pixelsPerMeter);
          const finalBlob = new Blob([withPhys], { type: "image/png" });

          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error || new Error("No se pudo leer el PNG final."));
          reader.readAsDataURL(finalBlob);
        } catch (err) {
          reject(err);
        }
      }, "image/png");
    });
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("No se pudo generar el JPEG."));
          return;
        }
        try {
          const arrayBuffer = await blob.arrayBuffer();
          let bytes = new Uint8Array(arrayBuffer);
          if (pxPerCm) {
            bytes = insertJpegDensity(bytes, pxPerCm);
          }
          const finalBlob = new Blob([bytes], { type: "image/jpeg" });

          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error || new Error("No se pudo leer el JPEG final."));
          reader.readAsDataURL(finalBlob);
        } catch (err) {
          reject(err);
        }
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

// Igual que getCroppedImage, pero expande el área de recorte `bleedPx`
// píxeles por lado (sangrado para producción) antes de dibujar. Si el área
// expandida se sale de los límites de la imagen original, extiende el
// borde (edge clamp) en vez de dejar transparencia o fallar. Pensada para
// la imagen que recibe el fabricante — la que ve el cliente en el sitio
// sigue usando getCroppedImage() sin sangrado.
//
// pxPerCm (opcional) es la densidad real del recorte (píxeles del
// recorte / cm del tamaño físico vendido) — si se pasa, el archivo
// resultante incrusta esa densidad como metadata (chunk pHYs en PNG,
// segmento JFIF en JPEG) para que cualquier software que lo abra muestre
// el tamaño físico correcto en cm/pulgadas, en vez de asumir 72 DPI por
// defecto. `format` = "png" (por defecto, usado por /estudio) o "jpeg"
// (usado por /crear — ver nota de JPEG_QUALITY arriba).
export function getCroppedImageWithBleed(imageSrc, croppedAreaPixels, bleedPx, pxPerCm, format = "png") {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = imageSrc;
    image.onload = () => {
      const expandedRect = {
        x: croppedAreaPixels.x - bleedPx,
        y: croppedAreaPixels.y - bleedPx,
        width: croppedAreaPixels.width + bleedPx * 2,
        height: croppedAreaPixels.height + bleedPx * 2,
      };

      const canvas = document.createElement("canvas");
      canvas.width = expandedRect.width;
      canvas.height = expandedRect.height;
      const ctx = canvas.getContext("2d");

      drawWithEdgeClamp(ctx, image, expandedRect);

      canvasToDataUrlWithDensity(canvas, pxPerCm, format).then(resolve, reject);
    };
    image.onerror = reject;
  });
}

// Convierte la primera página de un PDF a un dataURL de imagen usando pdfjs-dist.
export async function pdfFirstPageToImage(file) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");

  await page.render({ canvasContext: ctx, viewport }).promise;

  return canvas.toDataURL("image/png");
}
