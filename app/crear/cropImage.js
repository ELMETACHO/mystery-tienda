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

// Genera la imagen recortada final a partir del área seleccionada en react-easy-crop.
export function getCroppedImage(imageSrc, croppedAreaPixels) {
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

      resolve(canvas.toDataURL("image/png"));
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

// Igual que getCroppedImage, pero expande el área de recorte `bleedPx`
// píxeles por lado (sangrado para producción) antes de dibujar. Si el área
// expandida se sale de los límites de la imagen original, extiende el
// borde (edge clamp) en vez de dejar transparencia o fallar. Pensada para
// la imagen que recibe el fabricante — la que ve el cliente en el sitio
// sigue usando getCroppedImage() sin sangrado.
export function getCroppedImageWithBleed(imageSrc, croppedAreaPixels, bleedPx) {
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

      resolve(canvas.toDataURL("image/png"));
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
