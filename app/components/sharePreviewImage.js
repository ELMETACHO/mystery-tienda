// Composición de la imagen que se comparte desde "Tu cuadro está listo"
// (ver SharePreviewButton.jsx). Se carga solo al tocar el botón.
//
// En vez de recalcular la posición del cuadro sobre la foto de pared, se
// copia lo que el cliente YA ve: se mide el contenedor del mockup y cada
// <img> dentro de él (getBoundingClientRect) y se redibujan en un canvas
// en la misma posición — así la imagen compartida siempre coincide con la
// pantalla, aunque cambie la calibración del mockup en CrearFlow.

const SHARE_URL = "https://www.mysterycuadros.com";
const SHARE_TEXT = "¿Cómo te parece? Así quedaría mi cuadro 😍";
const OUTPUT_WIDTH = 1080;
const FOOTER_HEIGHT = 120;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function composePreview(container) {
  const box = container.getBoundingClientRect();
  const scale = OUTPUT_WIDTH / box.width;
  const height = Math.round(box.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = height + FOOTER_HEIGHT;
  const ctx = canvas.getContext("2d");

  // En orden del DOM: primero la foto de pared, después el recorte del
  // cliente encima (mismo apilado que en pantalla).
  for (const el of container.querySelectorAll("img")) {
    const r = el.getBoundingClientRect();
    const img = await loadImage(el.currentSrc || el.src);
    const x = (r.left - box.left) * scale;
    const y = (r.top - box.top) * scale;
    const w = r.width * scale;
    const h = r.height * scale;
    // object-cover: recorta la fuente al mismo aspecto que la caja.
    const srcRatio = img.naturalWidth / img.naturalHeight;
    const boxRatio = w / h;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (srcRatio > boxRatio) {
      sw = sh * boxRatio;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = sw / boxRatio;
      sy = (img.naturalHeight - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  ctx.fillStyle = "#1b2a4a";
  ctx.fillRect(0, height, OUTPUT_WIDTH, FOOTER_HEIGHT);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.fillText("Mystery Cuadros · mysterycuadros.com", OUTPUT_WIDTH / 2, height + FOOTER_HEIGHT / 2);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob vacío"))), "image/jpeg", 0.88)
  );
}

// Devuelve cómo se compartió ("share_image" | "share_link" | "download")
// para medirlo en el dataLayer, o lanza AbortError si el cliente canceló.
export async function shareReadyPreview(container) {
  let blob = null;
  try {
    blob = await composePreview(container);
  } catch (err) {
    console.error("[compartir] No se pudo armar la imagen:", err);
  }

  const file = blob ? new File([blob], "mi-cuadro-mystery.jpg", { type: "image/jpeg" }) : null;

  if (file && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text: `${SHARE_TEXT} ${SHARE_URL}` });
    return "share_image";
  }
  if (navigator.share) {
    await navigator.share({ text: SHARE_TEXT, url: SHARE_URL });
    return "share_link";
  }
  if (blob) {
    // Computador sin "Compartir": se descarga la imagen para mandarla a mano.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mi-cuadro-mystery.jpg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return "download";
  }
  return null;
}
