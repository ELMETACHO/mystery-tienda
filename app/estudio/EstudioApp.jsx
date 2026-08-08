"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import Cropper from "react-easy-crop";
import { getCroppedImage, getCroppedImageWithBleed, getDefaultCropArea } from "../crear/cropImage";
import { ESTUDIO_CATEGORIES } from "../lib/estudioCategories";
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

  const [selectedCategory, setSelectedCategory] = useState(null);

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
    setMockupConfirmed(false);
    setSelectedCategory(null);
    setUploadSuccess(false);
    setError("");
  };

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError("");

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Formato no soportado. Usa PNG, JPG o WEBP.");
      return;
    }

    setIsProcessingFile(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error("Error leyendo el archivo."));
        reader.readAsDataURL(file);
      });

      const dimensions = await new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error("No se pudo leer la imagen."));
        img.src = dataUrl;
      });

      setImageSrc(dataUrl);
      setImageDimensions(dimensions);
      setOriginalFileMeta({ name: file.name, type: file.type });
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setSelectedMockup(null);
      setMockupConfirmed(false);
      setSelectedCategory(null);
      setUploadSuccess(false);
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
      const imageBase64 = finalDataUrl.split(",")[1];
      const timestamp = Date.now();
      const filename = `mystery-mockup-${timestamp}.png`;

      // Imagen para "Original (Portafolio)": mismo recorte/zoom que el
      // mockup (finalCrop, ya en coordenadas de la imagen a resolución
      // completa — react-easy-crop devuelve croppedAreaPixels en el
      // espacio de píxeles nativo de la imagen original, no del canvas en
      // pantalla), pero SIN recomponer sobre ningún fondo, y con 1cm de
      // sangrado por lado agregado — misma función y misma lógica de
      // proporción (pxPerCm sobre el ancho de referencia 40cm) que ya usa
      // /crear para los pedidos de clientes.
      const widthCm = 40;
      const pxPerCm = finalCrop.width / widthCm;
      const bleedPx = Math.round(pxPerCm * 1);
      const originalWithBleedDataUrl = await getCroppedImageWithBleed(imageSrc, finalCrop, bleedPx);
      const originalImageBase64 = originalWithBleedDataUrl.split(",")[1];

      // getCroppedImageWithBleed siempre exporta PNG (ver cropImage.js),
      // así que el archivo final es PNG sin importar el formato que subió
      // el diseñador — el nombre refleja eso.
      const originalExtension = ".png";
      const safeBaseName = (originalFileMeta.name.includes(".")
        ? originalFileMeta.name.slice(0, originalFileMeta.name.lastIndexOf("."))
        : originalFileMeta.name
      )
        .replace(/[^a-zA-Z0-9-_ ]/g, "_")
        .trim() || "diseno";
      const originalFilename = `${safeBaseName}-original-${timestamp}${originalExtension}`;

      const res = await fetch("/api/estudio-upload-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          filename,
          originalImageBase64,
          originalFilename,
          originalMimeType: "image/png",
          categoryId: selectedCategory,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo subir el archivo a Drive");
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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Estudio de mockups</h1>
        <p className="mt-1 text-sm text-zinc-400">Sube, ajusta y envía a Drive en 4 pasos.</p>
      </div>

      <StepsIndicator steps={STEPS} current={step} />

      {step > 1 && (
        <button
          type="button"
          onClick={resetAll}
          className="self-center text-xs text-zinc-500 underline underline-offset-4 hover:text-zinc-300"
        >
          Empezar de nuevo
        </button>
      )}

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      {/* PASO 1: subir diseño — lo único visible al inicio. */}
      {step === 1 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
          <input
            id="estudio-file-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="absolute h-px w-px overflow-hidden opacity-0 pointer-events-none"
            tabIndex={-1}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <p className="text-lg font-medium text-zinc-100">Sube tu diseño</p>
          <p className="text-sm text-zinc-400">PNG, JPG o WEBP</p>
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
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              Todavía no hay imágenes en public/images/mockups-estudio/. Sube ahí los
              fondos (paredes/ambientes) y recarga esta página.
            </p>
          ) : (
            <>
              <div>
                <h2 className="mb-3 text-sm font-medium text-zinc-300">Elige un fondo</h2>
                <div className="flex gap-3 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible">
                  {mockups.map((file) => {
                    const isSelected = file === selectedMockup;
                    return (
                      <button
                        key={file}
                        type="button"
                        onClick={() => setSelectedMockup(file)}
                        className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition-colors sm:h-28 sm:w-28 ${
                          isSelected ? "border-accent" : "border-white/10 hover:border-white/30"
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
                    className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-white/10"
                    style={{ aspectRatio: previewAspect }}
                  >
                    <Image src={mockupSrc} alt="Fondo elegido" fill className="object-cover" />
                    <div
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
                    <p className="mb-2 text-center text-xs text-zinc-400">Zoom</p>
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
                    onClick={() => setMockupConfirmed(true)}
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
          <h2 className="mb-3 text-center text-base font-semibold text-zinc-100">
            Elige una categoría
          </h2>
          <div className="flex flex-wrap justify-center gap-2.5">
            {ESTUDIO_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className="rounded-full border-2 border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition-colors hover:border-accent hover:text-white"
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PASO 4: confirmar y enviar. */}
      {step === 4 && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center">
          <div className="relative aspect-[40/50] w-full max-w-[180px] overflow-hidden rounded-lg border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc} alt="Diseño elegido" className="h-full w-full object-cover" />
          </div>
          <p className="text-sm text-zinc-400">
            Categoría: <span className="font-medium text-zinc-200">{selectedCategoryLabel}</span>
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
              <p className="text-sm font-medium text-emerald-400">✔ Enviado a Drive</p>
              <button
                type="button"
                onClick={resetAll}
                className="text-xs text-zinc-500 underline underline-offset-4 hover:text-zinc-300"
              >
                Subir otro diseño
              </button>
            </>
          ) : (
            <p className="text-xs text-zinc-500">
              Sube el mockup (PNG 1080x1350) a "Mockups (Instagram)" y la imagen original en alta
              calidad a "Original (Portafolio)", dentro de la categoría elegida.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
