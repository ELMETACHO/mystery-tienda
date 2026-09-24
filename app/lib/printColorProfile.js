// Embebe el perfil de color sRGB en el archivo de impresión que se le
// adjunta al fabricante, para TODOS los pedidos (foto propia de /crear con
// o sin mejora de IA, catálogo de /estudio, regalos).
//
// Por qué: el canvas del navegador (cropImage.js) y Replicate generan
// archivos SIN perfil de color. Sin perfil, el software de impresión de
// Cris (el "RIP") tiene que adivinar qué significa cada valor RGB al
// convertir a CMYK y suele adivinar mal (colores apagados/oscuros). Cris
// confirmó (sept 2026) que el archivo CON perfil sRGB salió con color
// mucho mejor — antes solo lo llevaban los archivos que pasaban por la
// mejora con IA (ver upscaleImage.js).
//
// Nunca cambia un solo píxel ni la calidad:
//   - JPEG: se inserta el bloque APP2 "ICC_PROFILE" directamente en los
//     bytes del archivo, sin recomprimir.
//   - PNG: se reescribe con sharp (PNG es sin pérdida), conservando la
//     densidad física (px/cm) que define el tamaño de impresión.
// Si el archivo ya trae un perfil, se deja tal cual. Nunca lanza: ante
// cualquier error devuelve el archivo original.

let cachedSrgbApp2 = null;

// Segmento(s) APP2 con el perfil sRGB, sacados de un JPEG de 1x1 generado
// por sharp — así no hace falta guardar el binario del perfil en el repo.
async function getSrgbApp2Segments(sharp) {
  if (cachedSrgbApp2) return cachedSrgbApp2;
  const tiny = await sharp({
    create: { width: 1, height: 1, channels: 3, background: "#ffffff" },
  })
    .withIccProfile("srgb")
    .jpeg()
    .toBuffer();

  const segments = [];
  let i = 2; // después de SOI (FFD8)
  while (i + 4 <= tiny.length && tiny[i] === 0xff) {
    const marker = tiny[i + 1];
    if (marker === 0xda) break; // SOS: empiezan los datos de imagen
    const length = tiny.readUInt16BE(i + 2);
    const segment = tiny.subarray(i, i + 2 + length);
    if (marker === 0xe2 && segment.subarray(4, 16).toString("latin1") === "ICC_PROFILE\0") {
      segments.push(segment);
    }
    i += 2 + length;
  }
  if (segments.length === 0) throw new Error("No se pudo extraer el perfil sRGB de sharp.");
  cachedSrgbApp2 = Buffer.concat(segments);
  return cachedSrgbApp2;
}

// Inserta el APP2 después de SOI y de los APP0/APP1 iniciales (JFIF/EXIF
// deben seguir siendo los primeros segmentos del archivo).
function insertApp2(jpeg, app2) {
  let i = 2;
  while (i + 4 <= jpeg.length && jpeg[i] === 0xff && (jpeg[i + 1] === 0xe0 || jpeg[i + 1] === 0xe1)) {
    i += 2 + jpeg.readUInt16BE(i + 2);
  }
  return Buffer.concat([jpeg.subarray(0, i), app2, jpeg.subarray(i)]);
}

export async function embedSrgbProfile(base64) {
  if (!base64) return base64;
  try {
    const { default: sharp } = await import("sharp");
    const input = Buffer.from(base64, "base64");
    const meta = await sharp(input).metadata();
    if (meta.icc) return base64;

    if (meta.format === "jpeg") {
      const app2 = await getSrgbApp2Segments(sharp);
      return insertApp2(input, app2).toString("base64");
    }

    if (meta.format === "png") {
      let pipeline = sharp(input, { limitInputPixels: false }).withIccProfile("srgb");
      if (meta.density) pipeline = pipeline.withMetadata({ density: meta.density });
      const out = await pipeline.png().toBuffer();
      return out.toString("base64");
    }

    return base64;
  } catch (err) {
    console.error("[printColorProfile] No se pudo embeber el perfil sRGB, se envía el archivo original:", err);
    return base64;
  }
}
