"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Cropper from "react-easy-crop";
import { AnimatePresence, motion } from "motion/react";
import TextType from "../components/TextType";
import RecentesDriftWall from "../components/RecentesDriftWall";
import {
  getCroppedImage,
  getCroppedImageWithBleed,
  getDefaultCropArea,
  pdfFirstPageToImage,
} from "./cropImage";
import { SIZES, formatCOP, saveOrder } from "../lib/order";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "application/pdf"];

const STEPS = ["Subir foto", "Personalizar", "Finalizar pedido"];

// Foto de pared para la pantalla "Tu cuadro está listo" (sillón negro con
// pared vacía a la derecha). "zone" describe, en % del alto/ancho de la
// FOTO, el área de pared libre arriba/detrás del sillón donde colgaría un
// cuadro — calibrada a ojo mirando la foto; si se ve desalineada, son los
// valores a ajustar.
const MOCKUP = {
  src: "/images/mockups/mockup1.png",
  ratio: 1086 / 1448,
  zone: { left: 50, top: 3, width: 47, height: 62 },
};

// Fondo de ambiente para la pantalla de EDICIÓN (zoom/posición): repisa de
// madera con pared vacía arriba. "zone" es el área de pared libre sobre la
// repisa donde debe vivir el marco — calibrada a ojo mirando la foto
// (planta a la izquierda hasta ~20% del ancho, repisa empieza ~y=77%):
// si se ve desalineada, son los valores a ajustar.
const EDIT_BACKGROUND = {
  src: "/images/mockups/icon2.png",
  ratio: 1122 / 1402,
  zone: { left: 25, top: 1.5, width: 72, height: 75 },
};

// El tamaño físico más grande del catálogo (50x70, 70cm de alto) es la
// referencia: ocupa la mayor parte del alto de la zona definida. Los demás
// tamaños se calculan como fracción real de esa altura (misma proporción
// que existe entre 30x40 / 40x50 / 50x70 en centímetros), no como una
// diferencia arbitraria.
const MOCKUP_MAX_HEIGHT_CM = 70;

// Calcula, para un mockup con una "zone" definida (% de su propia imagen),
// el rectángulo (left/top/width/height, todo en %) donde debe ir el marco
// del tamaño elegido — centrado dentro de esa zona y con el mismo alto
// proporcional real entre tamaños. `maxZoneFill` controla cuánto del alto
// de la zona ocupa como máximo el tamaño más grande (deja aire alrededor).
function getFramePlacement(mockup, sizeId, sizeRatio, maxZoneFill = 0.78) {
  const heightCm = Number(sizeId.split("x")[1]);
  const { left, top, width, height } = mockup.zone;

  const heightPercent = (heightCm / MOCKUP_MAX_HEIGHT_CM) * maxZoneFill * height;
  const widthPercent = (heightPercent * sizeRatio) / mockup.ratio;

  const zoneCenterX = left + width / 2;
  const zoneCenterY = top + height / 2;

  return {
    left: `${zoneCenterX - widthPercent / 2}%`,
    top: `${zoneCenterY - heightPercent / 2}%`,
    width: `${widthPercent}%`,
    height: `${heightPercent}%`,
  };
}

// 0.9 dejaba el tamaño más grande (50x70) tocando o saliéndose del borde
// de la zona de pared del mockup de "listo"; bajado para que quede aire
// alrededor incluso en el caso más grande.
function getMockupOverlayStyle(sizeId, sizeRatio) {
  return getFramePlacement(MOCKUP, sizeId, sizeRatio, 0.78);
}

// Círculo indicador de paso, estilo tomado del componente Stepper de
// reactbits (StepIndicator): número mientras el paso no se completó,
// checkmark que se "dibuja" con motion/react cuando se completa. Colores
// ajustados al morado de marca de Mystery (--accent) en vez del morado
// genérico del ejemplo original (#5227ff).
function StepIndicator({ stepNumber, isDone, isCurrent }) {
  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors sm:h-7 sm:w-7 ${
        isDone
          ? "bg-accent text-white"
          : isCurrent
          ? "border-2 border-accent text-accent-soft"
          : "border border-white/15 text-zinc-500"
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDone ? (
          <motion.svg
            key="check"
            viewBox="0 0 24 24"
            fill="none"
            className="h-3.5 w-3.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.35, ease: "easeInOut", delay: 0.1 }}
            />
          </motion.svg>
        ) : (
          <motion.span
            key="number"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {stepNumber}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

// Línea conectora entre círculos, estilo StepConnector de reactbits: una
// base tenue (bg-white/10) con una capa morada encima que se "llena" con
// una animación de scaleX cuando el paso anterior se completa, en vez de
// simplemente cambiar de color de golpe.
function StepConnector({ isDone }) {
  return (
    <span className="relative mx-2 mb-4 h-px flex-1 overflow-hidden bg-white/10 sm:mx-3">
      <motion.span
        className="absolute inset-0 origin-left bg-accent"
        initial={false}
        animate={{ scaleX: isDone ? 1 : 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      />
    </span>
  );
}

function ProgressSteps({ current }) {
  return (
    <ol className="mx-auto mb-4 flex w-full max-w-md items-center sm:mb-6">
      {STEPS.map((step, i) => {
        const stepNumber = i + 1;
        const isDone = stepNumber < current;
        const isCurrent = stepNumber === current;
        return (
          <li key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <StepIndicator stepNumber={stepNumber} isDone={isDone} isCurrent={isCurrent} />
              <span
                className={`whitespace-nowrap text-[11px] sm:text-xs ${
                  isCurrent ? "font-medium text-zinc-200" : "text-zinc-500"
                }`}
              >
                {step}
              </span>
            </div>
            {stepNumber !== STEPS.length && <StepConnector isDone={isDone} />}
          </li>
        );
      })}
    </ol>
  );
}

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
    <path
      d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="13.5" r="3.2" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

const ZoomOutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-zinc-500">
    <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="m20 20-4.3-4.3M8 10.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const ZoomInIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-zinc-500">
    <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="m20 20-4.3-4.3M10.5 8v5M8 10.5h5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0 text-accent-soft">
    <rect x="5" y="10" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

// Ícono de marco vacío con "+" para la caja de subida — que se sienta como
// el inicio de crear algo, no un input de formulario genérico.
const EmptyFramePlusIcon = () => (
  <svg viewBox="0 0 64 64" fill="none" className="h-14 w-14 text-zinc-600" aria-hidden="true">
    <rect x="8" y="6" width="40" height="46" rx="2" stroke="currentColor" strokeWidth="2" />
    <rect x="14" y="12" width="28" height="34" rx="1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
    <circle cx="48" cy="48" r="11" fill="var(--background)" stroke="currentColor" strokeWidth="2" />
    <path d="M48 43v10M43 48h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Silueta de una persona de pie como referencia de escala junto a cada
// tamaño: su altura se calcula proporcional al alto real en cm (contra el
// mayor de los 3 tamaños), para que la diferencia se perciba a simple
// vista de forma más reconocible que un mueble.
function ScaleSilhouette({ heightCm, currentColorClass }) {
  const MAX_CM = 70;
  const MAX_PX = 34;
  const MIN_PX = 16;
  const heightPx = Math.max(MIN_PX, Math.round((heightCm / MAX_CM) * MAX_PX));

  return (
    <svg
      viewBox="0 0 14 32"
      fill="currentColor"
      style={{ height: heightPx, width: heightPx * (14 / 32) }}
      className={`shrink-0 ${currentColorClass}`}
      aria-hidden="true"
    >
      <circle cx="7" cy="4.5" r="4" />
      <path d="M7 11c-4 0-7 2.5-7 6v13.5C0 31.4.9 32 2 32s2-.6 2-1.5V17h1v13.5c0 1.4 1.3 2.5 2.9 2.5H8.1c1.6 0 2.9-1.1 2.9-2.5V17h1v13.5c0 .9.9 1.5 2 1.5s2-.6 2-1.5V17c0-3.5-3-6-7-6Z" />
    </svg>
  );
}

export default function CrearPage() {
  const router = useRouter();
  const [imageSrc, setImageSrc] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [error, setError] = useState("");

  const [sizeId, setSizeId] = useState(SIZES[0].id);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [imageDimensions, setImageDimensions] = useState(null);
  const [readyOrder, setReadyOrder] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  // Mismo patrón que RecentesDriftWall: matchMedia contra el breakpoint
  // "sm" de Tailwind (640px) para decidir el texto de la caja de carga
  // ("Arrastra..." no tiene sentido en un dispositivo táctil).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const selectedSize = SIZES.find((s) => s.id === sizeId);
  const isUploadScreen = !imageSrc && !readyOrder;

  // Solo en la primera pantalla (subir foto) y solo en móvil: la caja de
  // carga va primero, el indicador de pasos después, y la cabecera
  // (TextType + DriftWall) al final — en desktop (sm+) se resetea al
  // orden natural del DOM (cabecera → pasos → caja de carga).
  const mobileOrderHeader = isUploadScreen ? "order-3 sm:order-none" : "";
  const mobileOrderSteps = isUploadScreen ? "order-1 sm:order-none" : "";
  const mobileOrderUpload = isUploadScreen ? "order-2 sm:order-none" : "";

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
        const img = new window.Image();
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

    // Imagen para el fabricante: mismo recorte + 1cm de sangrado por lado,
    // escalado a la densidad real del recorte (no un valor fijo de
    // píxeles) — esta es la que se adjunta en el correo de producción. La
    // que ve el cliente (croppedImage, arriba) nunca lleva sangrado.
    const widthCm = Number(selectedSize.id.split("x")[0]);
    const pxPerCm = finalCrop.width / widthCm;
    const bleedPx = Math.round(pxPerCm * 1);
    const printImage = await getCroppedImageWithBleed(imageSrc, finalCrop, bleedPx);
    console.log("[sangrado] px/cm:", pxPerCm.toFixed(1), "bleedPx por lado:", bleedPx);

    // No navegamos todavía: mostramos primero la pantalla de confirmación
    // "Tu cuadro está listo" con el resultado final ya calculado, y
    // guardamos/navegamos recién cuando el usuario confirma desde ahí.
    setReadyOrder({
      sizeId: selectedSize.id,
      sizeLabel: selectedSize.label,
      priceCOP: selectedSize.priceCOP,
      croppedImage,
      printImage,
      isLowResolution,
    });
  };

  const handleConfirmReady = async () => {
    if (!readyOrder) return;
    await saveOrder(readyOrder);
    router.push("/checkout");
  };

  // Bloque de texto (título + subtítulos) de la primera pantalla — se
  // renderiza en dos posiciones posibles según el viewport (nunca las
  // dos a la vez): arriba de todo en móvil, o junto al DriftWall en
  // desktop (ver más abajo). El DriftWall en sí NO se mueve, solo este
  // texto cambia de lugar.
  const uploadTitleBlock = (
    <div className="flex flex-col items-center gap-1.5 text-center lg:items-start lg:text-left">
      <Link
        href="/"
        className="mb-1 inline-flex items-center gap-1 self-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200 lg:self-start"
      >
        ← Volver atrás
      </Link>
      <TextType
        as="h1"
        text="Cuadros personalizados"
        loop={false}
        typingSpeed={45}
        cursorCharacter="|"
        cursorClassName="text-accent"
        cursorBlinkDuration={0.6}
        className="text-2xl font-bold tracking-tight text-accent-soft sm:text-3xl md:text-4xl"
      />
      <p className="text-sm font-medium text-zinc-300 sm:text-base">
        Tu cuadro en 30 segundos
      </p>
      <p className="text-sm text-zinc-500 sm:text-base">Sigue los pasos de abajo</p>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-4 sm:px-6 sm:py-10">
      {/* En móvil, el título/subtítulos son lo primero que ve el cliente —
          por encima incluso del indicador de pasos. En desktop este bloque
          NO se duplica: se muestra junto al DriftWall más abajo (ver
          mobileOrderHeader), así que acá solo se renderiza cuando
          isMobile es true. */}
      {isUploadScreen && isMobile && (
        <div className="mb-6">{uploadTitleBlock}</div>
      )}

      {/* Cabecera de la primera pantalla (subir foto): texto tipo máquina
          de escribir + DriftWall en vez del título estático + el mockup
          lateral fijo que había antes — solo en este paso, los pasos 2/3
          conservan el título simple original. En móvil solo se ve el
          DriftWall acá (el texto ya se mostró arriba); en desktop se ven
          ambos lado a lado, como siempre. */}
      {isUploadScreen ? (
        <div className={`mb-6 grid items-center gap-6 sm:mb-8 sm:gap-8 lg:grid-cols-2 ${mobileOrderHeader}`}>
          {!isMobile && uploadTitleBlock}
          <RecentesDriftWall />
        </div>
      ) : (
        <div className="mb-2 text-center sm:mb-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            Crea tu cuadro
          </h1>
          <p className="mt-2 text-sm text-zinc-400 sm:text-base">
            En menos de un minuto podrás ver cómo se verá tu cuadro antes de comprarlo.
          </p>
        </div>
      )}

      <div className={mobileOrderSteps}>
        <ProgressSteps current={readyOrder ? 3 : imageSrc ? 2 : 1} />
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

      {readyOrder ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 py-8 text-center">
          {/* Composición sobre foto de pared real, en vez del cuadro suelto
              sobre fondo simple: se siente como el resultado final ya
              colgado, no solo una imagen recortada. El tamaño de la
              superposición varía según el tamaño elegido (ver
              getMockupOverlayStyle), guardando la proporción real entre
              30x40 / 40x50 / 50x70. */}
          <div
            key={readyOrder.croppedImage}
            className="relative w-full max-w-sm animate-ready-in overflow-hidden rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            style={{ aspectRatio: MOCKUP.ratio }}
          >
            <Image
              src={MOCKUP.src}
              alt="Cuadro colgado en la pared (mockup de referencia)"
              fill
              className="object-cover"
            />
            <div
              className="absolute overflow-hidden rounded-[2px] border border-black"
              style={{
                ...getMockupOverlayStyle(selectedSize.id, selectedSize.ratio),
                aspectRatio: selectedSize.ratio,
                boxShadow: "6px 10px 20px rgba(0,0,0,0.45)",
              }}
            >
              {/* Overscan de 1px: el recorte del usuario se dibuja un poco
                  más grande que su contenedor recortado, para que un
                  redondeo de subpíxel en el borde nunca deje ver una línea
                  de la foto de pared por debajo (el artefacto de "borde con
                  transparencia mal manejada"). */}
              <div className="absolute -inset-px">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={readyOrder.croppedImage}
                  alt="Vista final de tu cuadro"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          <div className="animate-ready-in flex flex-col items-center gap-1">
            <p className="text-xl font-semibold text-white sm:text-2xl">
              ✔ Tu cuadro está listo
            </p>
            <p className="text-sm text-zinc-400 sm:text-base">
              Solo falta decirnos dónde enviarlo
            </p>
          </div>

          <button
            type="button"
            onClick={handleConfirmReady}
            className="mt-2 w-full max-w-xs rounded-full bg-accent px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-accent-soft sm:py-3"
          >
            Continuar con el envío
          </button>

          <button
            type="button"
            onClick={() => setReadyOrder(null)}
            className="text-xs text-zinc-500 underline underline-offset-4 hover:text-zinc-300"
          >
            Seguir ajustando
          </button>
        </div>
      ) : !imageSrc ? (
        <div className={`flex flex-col gap-8 ${mobileOrderUpload}`}>
          {/* La caja de carga ahora ocupa todo el ancho: el mockup lateral
              estático que iba a su derecha se quitó (ver TextType +
              RecentesDriftWall en la cabecera de esta pantalla, más
              arriba, que ya cumplen ese rol visual). */}
          <div className="mx-auto grid w-full max-w-xl gap-6 sm:gap-8">
            <div className="flex flex-col gap-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                className={`flex min-h-56 scale-100 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-all duration-200 sm:min-h-72 sm:px-6 ${
                  isDragging
                    ? "scale-[1.015] border-accent bg-accent/10 shadow-[0_0_0_3px_rgba(168,85,247,0.55),0_0_45px_rgba(168,85,247,0.4)]"
                    : "border-white/15 bg-white/5 hover:scale-[1.01] hover:border-accent hover:bg-white/[0.07] hover:shadow-[0_0_0_3px_rgba(168,85,247,0.4),0_0_35px_rgba(168,85,247,0.28)]"
                }`}
              >
                {isProcessingFile ? (
                  <p className="text-zinc-300">Procesando archivo...</p>
                ) : (
                  <>
                    <EmptyFramePlusIcon />
                    <p className="text-lg font-medium">
                      {isMobile ? "Toca para subir tu foto" : "Arrastra tu imagen aquí"}
                    </p>
                    <p className="text-sm text-zinc-400">
                      PNG, JPG, HEIC (fotos de iPhone) o PDF (se usará la primera página)
                    </p>
                    <label
                      htmlFor="file-upload"
                      className="mt-2 cursor-pointer rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-soft"
                    >
                      Elegir mi fotografía
                    </label>
                    <p className="mt-1 text-xs text-zinc-500">
                      📱 Compatible con iPhone, Android y computador
                    </p>
                  </>
                )}
                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>

              <p className="px-1 text-center text-[11px] text-zinc-500">
                🔒 Tu imagen solo se utiliza para fabricar tu cuadro y nunca será compartida.
              </p>

              <ul className="flex flex-col gap-2 px-1 text-xs text-zinc-300">
                <li className="flex items-center gap-2">
                  <span aria-hidden="true">💡</span> Usa una imagen con buena iluminación
                </li>
                <li className="flex items-center gap-2">
                  <span aria-hidden="true">🔍</span> Entre mayor resolución, mejor impresión
                </li>
                <li className="flex items-center gap-2">
                  <span aria-hidden="true">🤏</span> Puedes mover y hacer zoom después
                </li>
              </ul>

              <p className="text-center text-xs text-zinc-500">
                Más de 1.000 cuadros entregados —{" "}
                <span className="text-accent-soft" aria-hidden="true">
                  ⭐⭐⭐⭐⭐
                </span>{" "}
                4.9
              </p>
            </div>
          </div>

          {/* Franja de confianza — tarjetas individuales en vez de texto
              plano, para que no pase desapercibida. */}
          <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-6 sm:grid-cols-4">
            {[
              "✔ Vista previa antes de pagar",
              "✔ Impresión premium sobre madera",
              "✔ Envíos a toda Colombia",
              "✔ Pago 100% seguro",
            ].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 text-center text-xs text-zinc-300"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[65fr_35fr] lg:items-start">
          {/* LIENZO — columna izquierda (~65%) */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative w-full max-w-[240px] overflow-hidden rounded-2xl sm:max-w-xl"
              style={{ aspectRatio: EDIT_BACKGROUND.ratio }}
            >
              {/* Fondo de ambiente: repisa de madera con pared vacía arriba.
                  Solo decorativo — nunca forma parte del recorte/validación
                  final, que sigue operando exclusivamente sobre la imagen
                  del usuario dentro del marco. */}
              <Image
                src={EDIT_BACKGROUND.src}
                alt="Ambiente de referencia"
                fill
                priority
                className="object-cover"
              />

              {/* Marco fijo sobre la repisa: posición y tamaño calculados
                  una vez por tamaño elegido (getFramePlacement) y no se
                  mueven — el zoom/arrastre de react-easy-crop queda
                  contenido DENTRO de este marco, el marco en sí es estático.
                  Los cuadros Mystery no tienen marco frontal visible (la
                  imagen cubre borde a borde; el marco físico va por detrás,
                  solo para colgar), así que acá no hay madera ni borde de
                  color — solo un contorno delgado de referencia y una
                  sombra sutil que sugiere que el cuadro está "despegado"
                  de la pared por la profundidad del marco trasero. */}
              <div
                className="absolute overflow-hidden rounded-sm bg-black"
                style={{
                  ...getFramePlacement(EDIT_BACKGROUND, selectedSize.id, selectedSize.ratio, 0.85),
                  border: "1.5px solid rgba(0,0,0,0.6)",
                  boxSizing: "border-box",
                  boxShadow: "6px 10px 18px rgba(0,0,0,0.35)",
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

            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span aria-hidden="true">✨</span> Así quedará impreso
            </p>

            {isLowResolution && (
              <div className="flex w-full max-w-xl flex-col items-stretch gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
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

            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>

          {/* PANEL DE CONTROL — columna derecha (~35%) */}
          <div className="flex w-full flex-col gap-6">
            <div>
              <h2 className="mb-2 text-sm font-medium text-zinc-300">Tu imagen</h2>
              <label
                htmlFor="file-upload"
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-accent/50 bg-transparent px-5 py-2.5 text-sm font-medium text-accent-soft transition-colors hover:bg-accent/10"
              >
                <CameraIcon />
                Cambiar foto
              </label>
            </div>

            {/* En móvil, "Ajuste" y "Tamaño" van lado a lado (grid de 2
                columnas) en vez de apilados: así ambos caben en menos alto
                y quedan visibles junto al mockup, sin scroll, para ver el
                efecto de cada cambio de inmediato. En desktop (sm+) vuelven
                a apilarse como antes, sin cambios de comportamiento. */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-1 sm:gap-6">
              <div>
                <h2 className="mb-3 text-sm font-medium text-zinc-300">Ajuste</h2>
                <div className="flex items-center gap-3">
                  <ZoomOutIcon />
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1"
                  />
                  <ZoomInIcon />
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  Arrastra la imagen para moverla
                </p>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-medium text-zinc-300">Tamaño</h2>
                <div className="flex flex-col gap-2">
                  {SIZES.map((size) => {
                    const heightCm = Number(size.id.split("x")[1]);
                    const isSelected = size.id === sizeId;
                    return (
                      <button
                        key={size.id}
                        type="button"
                        onClick={() => setSizeId(size.id)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors sm:px-4 sm:py-3 ${
                          isSelected
                            ? "border-accent bg-accent/15 shadow-[0_0_0_1px_rgba(168,85,247,0.6),0_0_20px_rgba(168,85,247,0.25)]"
                            : "border-white/10 bg-white/5 hover:border-white/20"
                        }`}
                      >
                        <span className="flex items-center gap-2 sm:gap-3">
                          <ScaleSilhouette
                            heightCm={heightCm}
                            currentColorClass={isSelected ? "text-accent-soft" : "text-zinc-500"}
                          />
                          <span className={`text-xs sm:text-sm ${isSelected ? "text-white" : "text-zinc-300"}`}>
                            {size.label}
                          </span>
                        </span>
                        <span
                          className={`text-sm font-bold sm:text-lg ${
                            isSelected ? "text-accent-soft" : "text-zinc-400"
                          }`}
                        >
                          {formatCOP(size.priceCOP)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleContinue}
              className="w-full rounded-full bg-accent px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-accent-soft sm:py-3"
            >
              Continuar
            </button>

            <div className="-mt-3 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
              <LockIcon />
              Pago 100% seguro con Wompi
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
