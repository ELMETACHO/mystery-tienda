"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import Cropper from "react-easy-crop";
import { getCroppedImage, getDefaultCropArea } from "../crear/cropImage";
import { ESTUDIO_CATEGORIES } from "../lib/estudioCategories";

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
// imagen. Si hace falta más precisión por mockup, el siguiente paso
// natural sería agregar controles de posición/tamaño por imagen.
const DESIGN_WIDTH_RATIO = 0.58; // % del ancho del canvas de exportación

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
  const [selectedMockup, setSelectedMockup] = useState(mockups[0] || null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [error, setError] = useState("");
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [imageDimensions, setImageDimensions] = useState(null);

  const [isExporting, setIsExporting] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const mockupSrc = selectedMockup ? `/images/mockups-estudio/${selectedMockup}` : null;

  const onCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

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
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
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
      const filename = `mystery-mockup-${Date.now()}.png`;

      const res = await fetch("/api/estudio-upload-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, filename, categoryId: selectedCategory }),
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Estudio de mockups</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Elige un fondo, sube tu diseño, ajústalo y envíalo a Drive listo para Instagram.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-zinc-100">
          1. Elige una categoría <span className="text-red-400">*</span>
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {ESTUDIO_CATEGORIES.map((category) => {
            const isSelected = category.id === selectedCategory;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(category.id);
                  setUploadSuccess(false);
                }}
                className={`rounded-full border-2 px-5 py-2.5 text-sm font-semibold transition-colors ${
                  isSelected
                    ? "border-accent bg-accent text-white shadow-[0_0_20px_rgba(168,85,247,0.5)]"
                    : "border-white/15 bg-white/5 text-zinc-300 hover:border-white/30"
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>
        {!selectedCategory && (
          <p className="mt-2 text-xs text-zinc-500">Obligatorio antes de poder enviar a Drive.</p>
        )}
      </div>

      {mockups.length === 0 ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Todavía no hay imágenes en public/images/mockups-estudio/. Sube ahí los
          fondos (paredes/ambientes) y recarga esta página.
        </p>
      ) : (
        <div>
          <h2 className="mb-3 text-sm font-medium text-zinc-300">2. Elige un fondo</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible">
            {mockups.map((file) => {
              const isSelected = file === selectedMockup;
              return (
                <button
                  key={file}
                  type="button"
                  onClick={() => {
                    setSelectedMockup(file);
                    setUploadSuccess(false);
                  }}
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
      )}

      <div>
        <h2 className="mb-3 text-sm font-medium text-zinc-300">3. Sube tu diseño</h2>
        <input
          id="estudio-file-upload"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="absolute h-px w-px overflow-hidden opacity-0 pointer-events-none"
          tabIndex={-1}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <label
          htmlFor="estudio-file-upload"
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-soft"
        >
          {isProcessingFile ? "Procesando..." : imageSrc ? "Cambiar diseño" : "Elegir diseño"}
        </label>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>

      {imageSrc && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-zinc-300">4. Ajusta el diseño (40x50)</h2>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="relative aspect-[40/50] w-full max-w-sm overflow-hidden rounded-xl bg-black">
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

            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-xs text-zinc-400">Zoom</p>
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

              {mockupSrc && (
                <div>
                  <p className="mb-2 text-xs text-zinc-400">Vista previa del fondo</p>
                  <div
                    className="relative w-full overflow-hidden rounded-xl border border-white/10"
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageSrc}
                        alt="Vista previa del diseño"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleSendToDrive}
                disabled={!canExport || isExporting}
                className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isExporting ? "Enviando..." : "Enviar a Drive"}
              </button>
              {uploadSuccess ? (
                <p className="text-sm font-medium text-emerald-400">✔ Enviado a Drive</p>
              ) : (
                <p className="text-xs text-zinc-500">
                  Se genera en PNG, 1080x1350 (4:5), y se sube directo a la carpeta de Drive.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
