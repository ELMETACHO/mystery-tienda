"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Image from "next/image";
import Cropper from "react-easy-crop";
import { getCroppedImage, getCroppedImageWithBleed, getDefaultCropArea } from "../crear/cropImage";
import { ESTUDIO_CATEGORIES } from "../lib/estudioCategories";
import { SIZES } from "../lib/order";
import StepsIndicator from "../components/StepsIndicator";

// Fijo siempre a 40x50 (ver instrucción): no hay selector de tamaño acá,
// a diferencia de /crear.
const DESIGN_RATIO = 40 / 50;

// Formato Instagram (post vertical 4:5).
const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1350;

// Placement genérico del diseño dentro del mockup: como las imágenes de
// fondo las sube el diseñador libremente (sin calibrar una "zone" por
// imagen, como sí se hace con los mockups propios de /crear), se usa un
// rectángulo centrado de tamaño fijo en vez de una posición calibrada por
// imagen.
const DESIGN_WIDTH_RATIO = 0.58; // % del ancho del canvas de exportación

const STEPS = ["Subir diseño", "Fondo y ajuste", "Categoría", "Enviar"];

// Convierte un dataURL (base64) a Blob sin pasarlo por nuestro servidor
// — fetch() sobre un data: URL se resuelve localmente en el navegador,
// no hace ninguna petición de red.
function dataUrlToBlob(dataUrl) {
  return fetch(dataUrl).then((res) => res.blob());
}

// PUT directo del navegador a la URL de sesión resumable de Drive, con
// diagnóstico explícito: un fetch() que nunca llega a tener respuesta
// (típico de un bloqueo CORS) lanza un TypeError genérico sin status ni
// headers que inspeccionar — se distingue de un error HTTP real (Drive
// respondió, pero con un status de error) para no confundir ambos casos
// en los logs.
async function putToDriveSession(sessionUrl, blob, label) {
  let res;
  try {
    res = await fetch(sessionUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: blob,
    });
  } catch (networkErr) {
    console.error(
      `[estudio] PUT a Drive (${label}) falló sin respuesta — típico de un bloqueo CORS o de red:`,
      { name: networkErr.name, message: networkErr.message, sessionUrl }
    );
    throw new Error(
      `No se pudo conectar con Drive para subir "${label}" (posible bloqueo CORS). Revisa la consola del navegador.`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[estudio] Drive respondió con error al subir "${label}":`, res.status, text);
    throw new Error(`Drive rechazó la subida de "${label}" (status ${res.status}).`);
  }

  // Drive devuelve {id, name, mimeType} al completar el PUT resumable —
  // el id del archivo es lo que necesitamos para hacerlo público y
  // registrar el producto en el catálogo.
  return res.json();
}

const MIME_EXTENSIONS = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

// Recalcula el rectángulo de recorte (en píxeles de la imagen a
// resolución completa) para OTRA proporción, reusando el mismo
// crop/zoom que el diseñador ya ajustó — sin esto, cada tamaño de
// impresión (30x40/40x50/50x70) recortaría una parte distinta de la
// composición sin que nadie la haya visto/aprobado.
//
// react-easy-crop no exporta su matemática interna de recorte (solo el
// componente), así que en vez de reimplementarla a mano (riesgo de
// bugs sutiles), se monta el MISMO componente real fuera de pantalla,
// con el mismo tamaño de contenedor que el que el diseñador usó, y se
// lee el resultado que él mismo ya calcula internamente vía
// onCropComplete. Es una técnica algo inusual, pero evita duplicar
// lógica no documentada de un paquete de terceros.
function captureCropPixelsForAspect({ imageSrc, crop, zoom, aspect, width, height }) {
  return new Promise((resolve, reject) => {
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-99999px";
    host.style.top = "0px";
    host.style.width = `${width}px`;
    host.style.height = `${height}px`;
    document.body.appendChild(host);
    const root = createRoot(host);

    let settled = false;
    let unmounted = false;
    // root.unmount() debe diferirse al siguiente tick: onCropComplete se
    // dispara DESDE DENTRO del commit de esta misma raíz oculta, así que
    // desmontarla sincrónicamente ahí mismo hace que React se queje
    // ("Attempted to synchronously unmount a root while React was
    // already rendering") — todavía no terminó de procesar el commit
    // que disparó este callback.
    const scheduleCleanup = () => {
      if (unmounted) return;
      unmounted = true;
      setTimeout(() => {
        root.unmount();
        host.remove();
      }, 0);
    };

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      scheduleCleanup();
      reject(new Error(`No se pudo calcular el recorte para la proporción ${aspect}`));
    }, 8000);

    root.render(
      <Cropper
        image={imageSrc}
        crop={crop}
        zoom={zoom}
        aspect={aspect}
        cropShape="rect"
        showGrid={false}
        objectFit="cover"
        onCropChange={() => {}}
        onZoomChange={() => {}}
        onCropComplete={(_area, pixels) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          resolve(pixels);
          scheduleCleanup();
        }}
      />
    );
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function EstudioApp({ mockups }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [imageDimensions, setImageDimensions] = useState(null);
  const [originalFileMeta, setOriginalFileMeta] = useState(null); // { name, type }
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [error, setError] = useState("");

  const [selectedMockup, setSelectedMockup] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [mockupConfirmed, setMockupConfirmed] = useState(false);
  // Tamaño real (px) del contenedor del Cropper, medido MIENTRAS el paso
  // 2 todavía está montado — no se puede leer cropBoxRef.current más
  // tarde (en handleSendToDrive, paso 4): para entonces React ya
  // desmontó ese <div> al avanzar de paso, y el ref queda en null.
  const [cropBoxSize, setCropBoxSize] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const cropBoxRef = useRef(null);

  // Hash SHA-256 del archivo crudo (calculado en handleFile, antes de
  // cualquier recorte/composición) + resultado de preguntarle al
  // servidor si ya existe un producto con ese mismo hash — aviso NO
  // bloqueante para detectar que el mismo diseño se subió antes en
  // otra categoría (ver /api/estudio-check-duplicate).
  const [contentHash, setContentHash] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null); // { category } | null

  const [isExporting, setIsExporting] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const mockupSrc = selectedMockup ? `/images/mockups-estudio/${selectedMockup}` : null;

  // Flujo secuencial: cada paso solo se muestra cuando el anterior está
  // resuelto — nada de formulario largo con todo visible de una.
  const step = !imageSrc ? 1 : !mockupConfirmed ? 2 : !selectedCategory ? 3 : 4;

  const onCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const resetAll = () => {
    setImageSrc(null);
    setImageDimensions(null);
    setOriginalFileMeta(null);
    setSelectedMockup(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCropBoxSize(null);
    setMockupConfirmed(false);
    setSelectedCategory(null);
    setUploadSuccess(false);
    setContentHash(null);
    setDuplicateWarning(null);
    setError("");
  };

  // SHA-256 vía Web Crypto (nativo del navegador, sin librerías) sobre
  // los bytes crudos del archivo — antes de cualquier recorte o cambio
  // de formato, así el hash es estable sin importar qué categoría o
  // ajuste se elija después.
  async function sha256Hex(arrayBuffer) {
    const digest = await window.crypto.subtle.digest("SHA-256", arrayBuffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError("");

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Formato no soportado. Usa PNG, JPG o WEBP.");
      return;
    }

    setIsProcessingFile(true);
    setDuplicateWarning(null);
    try {
      const [dataUrl, arrayBuffer] = await Promise.all([
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error || new Error("Error leyendo el archivo."));
          reader.readAsDataURL(file);
        }),
        file.arrayBuffer(),
      ]);

      const dimensions = await new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error("No se pudo leer la imagen."));
        img.src = dataUrl;
      });

      const hash = await sha256Hex(arrayBuffer);

      setImageSrc(dataUrl);
      setImageDimensions(dimensions);
      setOriginalFileMeta({ name: file.name, type: file.type });
      setContentHash(hash);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setCropBoxSize(null);
      setSelectedMockup(null);
      setMockupConfirmed(false);
      setSelectedCategory(null);
      setUploadSuccess(false);

      // No bloqueante: solo avisa, no impide seguir. Si la consulta
      // falla (red, servidor caído), simplemente no se muestra el
      // aviso esta vez — nunca le impide al diseñador seguir trabajando.
      try {
        const checkRes = await fetch("/api/estudio-check-duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentHash: hash }),
        });
        if (checkRes.ok) {
          const { duplicate, category } = await checkRes.json();
          if (duplicate) {
            setDuplicateWarning({ category });
          }
        }
      } catch (checkErr) {
        console.error("[estudio] No se pudo verificar duplicados:", checkErr);
      }
    } catch (err) {
      setError(err.message || "No se pudo procesar el archivo.");
    } finally {
      setIsProcessingFile(false);
    }
  }, []);

  const canExport = Boolean(mockupSrc && imageSrc && selectedCategory);

  const handleSendToDrive = async () => {
    if (!canExport) return;
    setIsExporting(true);
    setError("");
    setUploadSuccess(false);

    try {
      const finalCrop =
        croppedAreaPixels || getDefaultCropArea(imageDimensions, DESIGN_RATIO);
      const croppedDesignDataUrl = await getCroppedImage(imageSrc, finalCrop);

      const [mockupImg, designImg] = await Promise.all([
        loadImage(mockupSrc),
        loadImage(croppedDesignDataUrl),
      ]);

      const canvas = document.createElement("canvas");
      canvas.width = EXPORT_WIDTH;
      canvas.height = EXPORT_HEIGHT;
      const ctx = canvas.getContext("2d");

      // Mockup de fondo: "cover" del canvas completo (llena 1080x1350
      // recortando lo que sobre, nunca deja franjas vacías).
      const mockupRatio = mockupImg.naturalWidth / mockupImg.naturalHeight;
      const canvasRatio = EXPORT_WIDTH / EXPORT_HEIGHT;
      let mw, mh, mx, my;
      if (mockupRatio > canvasRatio) {
        mh = EXPORT_HEIGHT;
        mw = mh * mockupRatio;
        mx = (EXPORT_WIDTH - mw) / 2;
        my = 0;
      } else {
        mw = EXPORT_WIDTH;
        mh = mw / mockupRatio;
        mx = 0;
        my = (EXPORT_HEIGHT - mh) / 2;
      }
      ctx.drawImage(mockupImg, mx, my, mw, mh);

      // Diseño: rectángulo centrado, tamaño fijo (ver DESIGN_WIDTH_RATIO).
      const designWidth = EXPORT_WIDTH * DESIGN_WIDTH_RATIO;
      const designHeight = designWidth / DESIGN_RATIO;
      const designX = (EXPORT_WIDTH - designWidth) / 2;
      const designY = (EXPORT_HEIGHT - designHeight) / 2;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetX = 8;
      ctx.shadowOffsetY = 12;
      ctx.drawImage(designImg, designX, designY, designWidth, designHeight);
      ctx.restore();

      const finalDataUrl = canvas.toDataURL("image/png");
      const timestamp = Date.now();
      const filename = `mystery-mockup-${timestamp}.png`;

      const safeBaseName = (originalFileMeta.name.includes(".")
        ? originalFileMeta.name.slice(0, originalFileMeta.name.lastIndexOf("."))
        : originalFileMeta.name
      )
        .replace(/[^a-zA-Z0-9-_ ]/g, "_")
        .trim() || "diseno";

      // Foto original SIN recortar, tal cual la subió el diseñador (no
      // pasa por canvas, así que conserva su formato/calidad original) —
      // se guarda para poder recalcular el recorte más adelante si
      // cambia la lógica de sangrado, sin que el diseñador tenga que
      // repetir el ajuste de zoom/posición.
      const originalExtension = MIME_EXTENSIONS[originalFileMeta.type] || ".png";
      const originalRawFilename = `${safeBaseName}-original-${timestamp}${originalExtension}`;

      // Un recorte + sangrado horneado POR CADA TAMAÑO de venta
      // (30x40/40x50/50x70): cada uno tiene una proporción distinta (ver
      // CLAUDE.md, "Limitación conocida"), así que no basta con un solo
      // archivo — se recalcula el rectángulo de recorte para cada
      // proporción reusando el mismo crop/zoom que el diseñador ya
      // ajustó (ver captureCropPixelsForAspect arriba), y se hornea con
      // el sangrado de 1cm ya escalado a la densidad real de cada tamaño
      // (mismo principio de pxPerCm que ya usa /crear).
      //
      // cropBoxSize se mide y guarda en el onClick de "Continuar" del
      // paso 2 (mientras ese <div> todavía está montado) — para cuando
      // se llega acá (paso 4), React ya lo desmontó y cropBoxRef.current
      // sería null.
      if (!cropBoxSize) {
        throw new Error("No se pudo medir el área de recorte. Vuelve al paso anterior e intenta de nuevo.");
      }
      const printFiles = {};
      for (const size of SIZES) {
        const pixelsForSize =
          size.ratio === DESIGN_RATIO
            ? finalCrop
            : await captureCropPixelsForAspect({
                imageSrc,
                crop,
                zoom,
                aspect: size.ratio,
                width: cropBoxSize.width,
                height: cropBoxSize.height,
              });

        const widthCm = Number(size.id.split("x")[0]);
        const heightCm = Number(size.id.split("x")[1]);
        const pxPerCm = pixelsForSize.width / widthCm;
        const bleedPx = Math.round(pxPerCm * 1);
        // DIAGNÓSTICO TEMPORAL — quitar una vez confirmada la causa del
        // bug de 30x40 (ver conversación).
        console.log(`[estudio][diag] bake ${size.id}`, {
          widthCm,
          heightCm,
          // Resolución REAL de la foto subida (antes de cualquier
          // recorte) — referencia para saber si pixelsForSize.width/
          // Height es una fracción razonable de la imagen real, o si en
          // cambio está pegado al tamaño en pantalla del contenedor.
          originalImageWidth: imageDimensions?.width,
          originalImageHeight: imageDimensions?.height,
          cropBoxSizeWidth: cropBoxSize.width,
          cropBoxSizeHeight: cropBoxSize.height,
          pixelsForSizeWidth: pixelsForSize.width,
          pixelsForSizeHeight: pixelsForSize.height,
          pxPerCm,
          bleedPx,
          finalCanvasWidthPx: pixelsForSize.width + bleedPx * 2,
          finalCanvasHeightPx: pixelsForSize.height + bleedPx * 2,
        });
        const dataUrl = await getCroppedImageWithBleed(imageSrc, pixelsForSize, bleedPx, pxPerCm);
        printFiles[size.id] = {
          dataUrl,
          filename: `${safeBaseName}-print-${size.id}-${timestamp}.png`,
        };
      }

      // Paso 1: pedirle al servidor solo METADATA (nombre + tipo de cada
      // archivo) — nunca los bytes de la imagen, así se evita el
      // FUNCTION_PAYLOAD_TOO_LARGE de Vercel con imágenes de alta
      // resolución. El servidor devuelve una URL de sesión de Drive
      // (resumable upload) por archivo, ya autorizada para esa subida
      // puntual.
      const filesToUpload = [
        { key: "mockup", filename, mimeType: "image/png", folder: "mockups" },
        {
          key: "originalRaw",
          filename: originalRawFilename,
          mimeType: originalFileMeta.type,
          folder: "original",
        },
        ...SIZES.map((size) => ({
          key: `print_${size.id}`,
          filename: printFiles[size.id].filename,
          mimeType: "image/png",
          folder: "original",
        })),
      ];

      const sessionRes = await fetch("/api/estudio-upload-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: selectedCategory, files: filesToUpload }),
      });

      if (!sessionRes.ok) {
        const data = await sessionRes.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo preparar la subida a Drive");
      }

      const { uploadUrls } = await sessionRes.json();

      // Paso 2: el navegador sube los archivos pesados DIRECTAMENTE a
      // Google con esas URLs de sesión — nunca pasan por nuestro
      // servidor/Vercel.
      const printBlobEntries = await Promise.all(
        SIZES.map(async (size) => [
          `print_${size.id}`,
          await dataUrlToBlob(printFiles[size.id].dataUrl),
        ])
      );
      const blobsByKey = {
        mockup: await dataUrlToBlob(finalDataUrl),
        originalRaw: await dataUrlToBlob(imageSrc),
        ...Object.fromEntries(printBlobEntries),
      };

      const uploadedByKey = {};
      await Promise.all(
        Object.entries(blobsByKey).map(async ([key, blob]) => {
          uploadedByKey[key] = await putToDriveSession(uploadUrls[key], blob, key);
        })
      );

      // Paso 3: registrar el producto en el catálogo (Redis) — hace
      // público el mockup en Drive (para el link de miniatura) y guarda
      // el registro, todo automático, sin pasos extra para el diseñador.
      const registerRes = await fetch("/api/estudio-register-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: selectedCategory,
          mockupFileId: uploadedByKey.mockup.id,
          originalRawFileId: uploadedByKey.originalRaw.id,
          originalRawContentHash: contentHash,
          printFileIds: {
            "30x40": uploadedByKey.print_30x40.id,
            "40x50": uploadedByKey.print_40x50.id,
            "50x70": uploadedByKey.print_50x70.id,
          },
          crop,
          zoom,
        }),
      });

      if (!registerRes.ok) {
        const data = await registerRes.json().catch(() => ({}));
        throw new Error(
          data.error ||
            "Los archivos se subieron a Drive pero no se pudo registrar el producto en el catálogo"
        );
      }

      setUploadSuccess(true);
    } catch (err) {
      console.error("[estudio] Error subiendo mockup a Drive:", err);
      setError(err.message || "No se pudo generar/subir la imagen. Intenta de nuevo.");
    } finally {
      setIsExporting(false);
    }
  };

  const previewAspect = useMemo(() => EXPORT_WIDTH / EXPORT_HEIGHT, []);
  const selectedCategoryLabel = ESTUDIO_CATEGORIES.find((c) => c.id === selectedCategory)?.label;
  const duplicateCategoryLabel = duplicateWarning
    ? ESTUDIO_CATEGORIES.find((c) => c.id === duplicateWarning.category)?.label ||
      duplicateWarning.category
    : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Estudio de mockups</h1>
        <p className="mt-1 text-sm text-[#33456b]">Sube, ajusta y envía a Drive en 4 pasos.</p>
      </div>

      <StepsIndicator steps={STEPS} current={step} />

      {step > 1 && (
        <button
          type="button"
          onClick={resetAll}
          className="self-center text-xs text-[#5b6b8c] underline underline-offset-4 hover:text-[#33456b]"
        >
          Empezar de nuevo
        </button>
      )}

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      {/* Aviso NO bloqueante: el diseñador puede seguir igual si de
          verdad quiere volver a subir el mismo diseño a propósito. */}
      {duplicateWarning && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-800">
          ⚠ Este diseño ya está en el catálogo (categoría: {duplicateCategoryLabel}). Puedes
          seguir igual si quieres subirlo de todas formas.
        </p>
      )}

      {/* PASO 1: subir diseño — lo único visible al inicio. */}
      {step === 1 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-black/10 bg-[#fffaf0] px-6 py-12 text-center">
          <input
            id="estudio-file-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="absolute h-px w-px overflow-hidden opacity-0 pointer-events-none"
            tabIndex={-1}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <p className="text-lg font-medium text-[#1b2a4a]">Sube tu diseño</p>
          <p className="text-sm text-[#33456b]">PNG, JPG o WEBP</p>
          <label
            htmlFor="estudio-file-upload"
            className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-soft"
          >
            {isProcessingFile ? "Procesando..." : "Elegir diseño"}
          </label>
        </div>
      )}

      {/* PASO 2: fondo/mockup + ajuste de zoom/posición. */}
      {step === 2 && (
        <div className="flex flex-col gap-6">
          {mockups.length === 0 ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
              Todavía no hay imágenes en public/images/mockups-estudio/. Sube ahí los
              fondos (paredes/ambientes) y recarga esta página.
            </p>
          ) : (
            <>
              <div>
                <h2 className="mb-3 text-sm font-medium text-[#33456b]">Elige un fondo</h2>
                <div className="flex gap-3 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible">
                  {mockups.map((file) => {
                    const isSelected = file === selectedMockup;
                    return (
                      <button
                        key={file}
                        type="button"
                        onClick={() => setSelectedMockup(file)}
                        className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition-colors sm:h-28 sm:w-28 ${
                          isSelected ? "border-accent" : "border-black/10 hover:border-black/20"
                        }`}
                      >
                        <Image
                          src={`/images/mockups-estudio/${file}`}
                          alt={file}
                          fill
                          sizes="112px"
                          className="object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedMockup && (
                <div className="flex flex-col items-center gap-4">
                  {/* Única vista: el mockup agrandado, con el área de
                      recorte interactivo (react-easy-crop) posicionada
                      directamente encima, en el mismo rectángulo donde
                      luego se compone el diseño final — no hay un
                      componente de ajuste aparte. Esto también evita
                      recalcular/regenerar una vista previa duplicada por
                      separado (causa probable del delay notado antes). */}
                  <div
                    className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-black/10"
                    style={{ aspectRatio: previewAspect }}
                  >
                    <Image src={mockupSrc} alt="Fondo elegido" fill className="object-cover" />
                    <div
                      ref={cropBoxRef}
                      className="absolute overflow-hidden rounded-sm border border-black/60 shadow-lg"
                      style={{
                        left: `${(1 - DESIGN_WIDTH_RATIO) * 50}%`,
                        width: `${DESIGN_WIDTH_RATIO * 100}%`,
                        aspectRatio: DESIGN_RATIO,
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                    >
                      <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={DESIGN_RATIO}
                        cropShape="rect"
                        showGrid={false}
                        objectFit="cover"
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                      />
                    </div>
                  </div>

                  <div className="w-full max-w-xs">
                    <p className="mb-2 text-center text-xs text-[#33456b]">Zoom</p>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.01}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const rect = cropBoxRef.current?.getBoundingClientRect();
                      if (rect) {
                        setCropBoxSize({ width: rect.width, height: rect.height });
                      }
                      setMockupConfirmed(true);
                    }}
                    className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-soft"
                  >
                    Continuar
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* PASO 3: categoría. */}
      {step === 3 && (
        <div>
          <h2 className="mb-3 text-center text-base font-semibold text-[#1b2a4a]">
            Elige una categoría
          </h2>
          <div className="flex flex-wrap justify-center gap-2.5">
            {ESTUDIO_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className="rounded-full border-2 border-black/10 bg-[#fffaf0] px-5 py-2.5 text-sm font-semibold text-[#33456b] transition-colors hover:border-accent hover:text-[#1b2a4a]"
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PASO 4: confirmar y enviar. */}
      {step === 4 && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-black/10 bg-[#fffaf0] px-6 py-10 text-center">
          <div className="relative aspect-[40/50] w-full max-w-[180px] overflow-hidden rounded-lg border border-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc} alt="Diseño elegido" className="h-full w-full object-cover" />
          </div>
          <p className="text-sm text-[#33456b]">
            Categoría: <span className="font-medium text-[#1b2a4a]">{selectedCategoryLabel}</span>
          </p>

          <button
            type="button"
            onClick={handleSendToDrive}
            disabled={!canExport || isExporting}
            className="rounded-full bg-accent px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isExporting ? "Enviando..." : "Enviar a Drive"}
          </button>

          {uploadSuccess ? (
            <>
              <p className="text-sm font-medium text-emerald-700">✔ Producto agregado al catálogo</p>
              <button
                type="button"
                onClick={resetAll}
                className="text-xs text-[#5b6b8c] underline underline-offset-4 hover:text-[#33456b]"
              >
                Subir otro diseño
              </button>
            </>
          ) : (
            <p className="text-xs text-[#5b6b8c]">
              Sube el mockup (PNG 1080x1350) a &ldquo;Mockups (Instagram)&rdquo; y la foto original
              + los 3 recortes de impresión (30x40/40x50/50x70) a &ldquo;Original
              (Portafolio)&rdquo;, dentro de la categoría elegida.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
