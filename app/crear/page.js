"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Cropper from "react-easy-crop";
import {
  getCroppedImage,
  getDefaultCropArea,
  pdfFirstPageToImage,
} from "./cropImage";
import { SIZES, saveOrder } from "../lib/order";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "application/pdf"];

export default function CrearPage() {
  const router = useRouter();
  const [imageSrc, setImageSrc] = useState(null);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [error, setError] = useState("");

  const [sizeId, setSizeId] = useState(SIZES[0].id);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [imageDimensions, setImageDimensions] = useState(null);

  const fileInputRef = useRef(null);
  const selectedSize = SIZES.find((s) => s.id === sizeId);

  const isLowResolution =
    imageDimensions &&
    (imageDimensions.width < selectedSize.minWidth ||
      imageDimensions.height < selectedSize.minHeight);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError("");

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Formato no soportado. Usa PNG, JPG o PDF.");
      return;
    }

    setIsProcessingFile(true);
    try {
      let dataUrl;
      if (file.type === "application/pdf") {
        dataUrl = await pdfFirstPageToImage(file);
      } else {
        dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      const dimensions = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = reject;
        img.src = dataUrl;
      });

      setFileName(file.name);
      setImageSrc(dataUrl);
      setImageDimensions(dimensions);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    } catch (err) {
      console.error(err);
      setError("No se pudo procesar el archivo. Intenta con otro.");
    } finally {
      setIsProcessingFile(false);
    }
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      handleFile(e.dataTransfer.files?.[0]);
    },
    [handleFile]
  );

  const onCropComplete = useCallback((_croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleContinue = async () => {
    console.log("Click en Continuar - imageSrc:", imageSrc, "croppedAreaPixels:", croppedAreaPixels);
    if (!imageSrc) return;

    // Si el usuario nunca interactuó con el zoom/arrastre, react-easy-crop
    // no habrá emitido croppedAreaPixels todavía: lo calculamos aquí mismo
    // como respaldo para que "Continuar" siempre tenga un valor válido.
    const finalCrop =
      croppedAreaPixels || getDefaultCropArea(imageDimensions, selectedSize.ratio);

    const croppedImage = await getCroppedImage(imageSrc, finalCrop);
    console.log("Tamaño elegido:", selectedSize.label);
    console.log("Resolución original:", imageDimensions);
    console.log("Resolución baja para este tamaño:", isLowResolution);
    console.log("Imagen recortada (dataURL):", croppedImage);

    await saveOrder({
      sizeId: selectedSize.id,
      sizeLabel: selectedSize.label,
      priceCOP: selectedSize.priceCOP,
      croppedImage,
      isLowResolution,
    });
    router.push("/checkout");
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Crea tu cuadro
        </h1>
        <p className="mt-2 text-zinc-400">
          Sube tu foto, ajústala dentro del marco y elige el tamaño.
        </p>
      </div>

      {!imageSrc ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 text-center transition-colors ${
            isDragging
              ? "border-accent bg-accent/10"
              : "border-white/15 bg-white/5"
          }`}
        >
          {isProcessingFile ? (
            <p className="text-zinc-300">Procesando archivo...</p>
          ) : (
            <>
              <p className="text-lg font-medium">
                Arrastra tu imagen aquí
              </p>
              <p className="text-sm text-zinc-400">
                PNG, JPG o PDF (se usará la primera página)
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-soft"
              >
                Seleccionar archivo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex flex-1 flex-col items-center gap-4">
            <div
              className="relative w-full max-w-md overflow-hidden rounded-lg p-10"
              style={{
                background:
                  "repeating-linear-gradient(90deg, #b98a5a, #b98a5a 18px, #a97a4a 18px, #a97a4a 36px)",
              }}
            >
              <div
                className="relative mx-auto bg-black/40 shadow-2xl"
                style={{
                  width: "100%",
                  aspectRatio: selectedSize.ratio,
                  border: "14px solid #1c1c1c",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
                }}
              >
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={selectedSize.ratio}
                  cropShape="rect"
                  showGrid={false}
                  objectFit="cover"
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
            </div>

            <div className="flex w-full max-w-md items-center gap-3">
              <span className="text-sm text-zinc-400">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="accent-accent flex-1"
              />
            </div>

            {isLowResolution && (
              <div className="flex w-full max-w-md flex-col items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <p className="text-sm text-amber-300">
                  La resolución de la imagen es baja para el tamaño elegido, pero se mejorará con IA más adelante.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 rounded-full border border-amber-400/40 px-4 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/20"
                >
                  Prefiero subir otra imagen
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-accent-soft underline underline-offset-4"
            >
              Cambiar imagen ({fileName})
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          <div className="flex w-full flex-col gap-6 lg:w-64">
            <div>
              <h2 className="mb-3 text-sm font-medium text-zinc-300">
                Tamaño
              </h2>
              <div className="flex flex-col gap-2">
                {SIZES.map((size) => (
                  <button
                    key={size.id}
                    type="button"
                    onClick={() => setSizeId(size.id)}
                    className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                      size.id === sizeId
                        ? "border-accent bg-accent/10 text-white"
                        : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20"
                    }`}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleContinue}
              className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-soft"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
