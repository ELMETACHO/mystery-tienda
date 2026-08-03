"use client";

import { useCallback, useState } from "react";
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

  const selectedSize = SIZES.find((s) => s.id === sizeId);

  const isLowResolution =
    imageDimensions &&
    (imageDimensions.width < selectedSize.minWidth ||
      imageDimensions.height < selectedSize.minHeight);

  const handleFile = useCallback(async (file) => {
    console.log("[crear] Archivo seleccionado:", file?.name, file?.type, file?.size);

    if (!file) {
      console.warn("[crear] handleFile se llamó sin archivo (selección cancelada?)");
      return;
    }

    setError("");
    setIsProcessingFile(true);

    try {
      const isHeic =
        file.type === "image/heic" ||
        file.type === "image/heif" ||
        /\.hei[cf]$/i.test(file.name);

      let workingFile = file;

      if (isHeic) {
        // Los iPhone guardan fotos en HEIC/HEIF por defecto, formato que la
        // mayoría de navegadores no puede leer directamente en canvas/<img>.
        // Lo convertimos a JPEG en el propio navegador antes de continuar.
        console.log("[crear] Detectado archivo HEIC/HEIF, convirtiendo a JPEG...");
        try {
          const heic2any = (await import("heic2any")).default;
          const converted = await heic2any({
            blob: file,
            toType: "image/jpeg",
            quality: 0.9,
          });
          const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
          workingFile = new File(
            [convertedBlob],
            file.name.replace(/\.hei[cf]$/i, ".jpg"),
            { type: "image/jpeg" }
          );
          console.log(
            "[crear] Conversión HEIC -> JPEG exitosa:",
            workingFile.name,
            workingFile.size,
            "bytes"
          );
        } catch (heicErr) {
          console.error("[crear] Falló la conversión HEIC -> JPEG:", heicErr);
          throw new Error(
            "No se pudo convertir esta foto HEIC/HEIF. Prueba exportarla como JPG desde tu galería e intenta de nuevo."
          );
        }
      } else if (!ACCEPTED_TYPES.includes(workingFile.type)) {
        throw new Error("Formato no soportado. Usa PNG, JPG, HEIC o PDF.");
      }

      let dataUrl;
      if (workingFile.type === "application/pdf") {
        console.log("[crear] Convirtiendo primera página del PDF a imagen...");
        dataUrl = await pdfFirstPageToImage(workingFile);
        console.log("[crear] PDF convertido a imagen correctamente");
      } else {
        console.log("[crear] Leyendo archivo como dataURL...");
        dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () =>
            reject(reader.error || new Error("Error leyendo el archivo."));
          reader.readAsDataURL(workingFile);
        });
        console.log("[crear] Archivo leído como dataURL, longitud:", dataUrl?.length);
      }

      console.log("[crear] Cargando imagen para calcular dimensiones...");
      const dimensions = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () =>
          reject(
            new Error(
              "No se pudo leer la imagen. El archivo puede estar dañado o en un formato no soportado."
            )
          );
        img.src = dataUrl;
      });
      console.log("[crear] Dimensiones obtenidas:", dimensions);

      setFileName(workingFile.name);
      setImageSrc(dataUrl);
      setImageDimensions(dimensions);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      console.log("[crear] Imagen cargada y lista para editar");
    } catch (err) {
      console.error("[crear] Error procesando el archivo:", err);
      setError(err?.message || "No se pudo procesar el archivo. Intenta con otro.");
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
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-4 sm:gap-10 sm:px-6 sm:py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
          Crea tu cuadro
        </h1>
        <p className="mt-2 text-sm text-zinc-400 sm:text-base">
          Sube tu foto, ajústala dentro del marco y elige el tamaño.
        </p>
      </div>

      {/* Input único, reutilizado por todos los <label htmlFor="file-upload">
          de esta página. El navegador abre el selector de archivos nativo al
          tocar cualquier label conectado por "for" — sin JS ni .click()
          programático, que algunos navegadores móviles bloquean. */}
      <input
        id="file-upload"
        type="file"
        accept=".png,.jpg,.jpeg,.heic,.heif,.pdf,image/png,image/jpeg,image/heic,image/heif,application/pdf"
        className="absolute h-px w-px overflow-hidden opacity-0 pointer-events-none"
        tabIndex={-1}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {!imageSrc ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`flex min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors sm:min-h-72 sm:px-6 ${
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
                PNG, JPG, HEIC (fotos de iPhone) o PDF (se usará la primera página)
              </p>
              <label
                htmlFor="file-upload"
                className="mt-2 cursor-pointer rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-soft"
              >
                Seleccionar archivo
              </label>
            </>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-6 sm:gap-8 lg:flex-row">
          <div className="flex flex-1 flex-col items-center gap-4">
            <div
              className="relative w-full max-w-md overflow-hidden rounded-lg p-3 sm:p-6 md:p-10"
              style={{
                background:
                  "repeating-linear-gradient(90deg, #b98a5a, #b98a5a 18px, #a97a4a 18px, #a97a4a 36px)",
              }}
            >
              {/* width:100% + aspect-ratio es el patrón que react-easy-crop
                  necesita para medir bien su contenedor (getBoundingClientRect
                  no debe devolver 0 en el primer render). El tope de tamaño en
                  pantallas chicas se logra con maxWidth calculado a partir de
                  un alto de pantalla objetivo (~58vh), no achicando el alto
                  directamente — así el marco sigue siendo ancho-driven y el
                  cropper se renderiza correctamente. Deja espacio arriba/abajo
                  para poder hacer scroll sin tocar la imagen. */}
              <div
                className="relative mx-auto bg-black/40 shadow-2xl"
                style={{
                  width: "100%",
                  maxWidth: `calc(58vh * ${selectedSize.ratio})`,
                  aspectRatio: selectedSize.ratio,
                  border: "10px solid #1c1c1c",
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

            <div className="flex w-full max-w-md items-center gap-3 px-1 py-2">
              <span className="text-sm text-zinc-400">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
              />
            </div>

            {isLowResolution && (
              <div className="flex w-full max-w-md flex-col items-stretch gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <p className="text-sm text-amber-300">
                  La resolución de la imagen es baja para el tamaño elegido, pero se mejorará con IA más adelante.
                </p>
                <label
                  htmlFor="file-upload"
                  className="shrink-0 cursor-pointer rounded-full border border-amber-400/40 px-4 py-2 text-center text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/20 sm:self-start sm:py-1.5"
                >
                  Prefiero subir otra imagen
                </label>
              </div>
            )}

            <label
              htmlFor="file-upload"
              className="cursor-pointer py-1 text-sm text-accent-soft underline underline-offset-4"
            >
              Cambiar imagen ({fileName})
            </label>
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
                    className={`w-full rounded-lg border px-4 py-3.5 text-left text-sm transition-colors sm:py-3 ${
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
              className="w-full rounded-full bg-accent px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-accent-soft sm:py-3"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
