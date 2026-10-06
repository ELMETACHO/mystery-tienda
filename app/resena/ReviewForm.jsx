"use client";

import { useState } from "react";

// Achica la foto EN EL NAVEGADOR antes de subirla (≤1600 px, JPEG 0,85):
// una foto de celular de 4-8 MB queda en ~300-600 KB, sube rápido con
// datos móviles y nunca se acerca al límite de 4,5 MB de Vercel. El
// servidor la vuelve a procesar con sharp (quita EXIF/GPS).
const MAX_PHOTO_SIDE = 1600;

async function compressPhoto(file) {
  let source;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    source = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No pudimos leer esa foto. Intenta con una JPG o PNG."));
      };
      img.src = url;
    });
  }
  const w = source.width;
  const h = source.height;
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function ReviewForm({ reference, token }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [consent, setConsent] = useState(false);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("El archivo debe ser una foto (JPG o PNG).");
      return;
    }
    setError("");
    setPhotoBusy(true);
    try {
      setPhoto(await compressPhoto(file));
    } catch (err) {
      setError(err.message || "No pudimos leer esa foto. Intenta con otra.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1) {
      setError("Elige una calificación de 1 a 5 estrellas.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/submit-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref: reference,
          token,
          rating,
          comment,
          consent,
          // Sin autorización la foto no se envía (no se podría publicar).
          photo: consent ? photo : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar tu reseña.");
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-black/5 bg-[#fffaf0] px-6 py-10 shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)] text-center">
        <p className="text-2xl">🎉</p>
        <p className="text-lg font-semibold text-[#1b2a4a]">¡Gracias por tu reseña!</p>
        <p className="text-sm text-[#5b6b8c]">
          {consent
            ? "La revisamos y, si todo está bien, la publicamos en la tienda en unos días."
            : "Nos ayuda mucho a seguir mejorando."}
        </p>
      </div>
    );
  }

  const displayRating = hoverRating || rating;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-2xl border border-black/5 bg-[#fffaf0] px-6 py-8 shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)]"
    >
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-[#33456b]">¿Cuántas estrellas le das a tu cuadro?</p>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} estrella${value > 1 ? "s" : ""}`}
              onClick={() => setRating(value)}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 text-4xl leading-none transition-transform hover:scale-110"
            >
              <span className={value <= displayRating ? "text-accent" : "text-[#c9cfdc]"}>★</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="review-comment" className="text-sm text-[#33456b]">
          Comentario (opcional)
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Cuéntanos qué te pareció tu cuadro..."
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#1b2a4a] placeholder:text-[#8a97b3] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-[#33456b]">Foto de tu cuadro en la pared (opcional)</p>
        {photo ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (data URL) */}
            <img src={photo} alt="Vista previa de tu foto" className="h-20 w-20 rounded-xl object-cover" />
            <button
              type="button"
              onClick={() => setPhoto(null)}
              className="text-sm text-[#5b6b8c] underline underline-offset-4 hover:text-[#1b2a4a]"
            >
              Quitar foto
            </button>
          </div>
        ) : (
          <label
            htmlFor="review-photo"
            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-black/20 bg-white px-3 py-4 text-sm text-[#33456b] hover:border-accent"
          >
            {photoBusy ? "Preparando foto…" : "📷 Subir una foto"}
          </label>
        )}
        <input
          id="review-photo"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={handlePhotoChange}
          className="sr-only"
        />
      </div>

      <label htmlFor="review-consent" className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-[#5b6b8c]">
        <input
          id="review-consent"
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
        />
        <span>
          Autorizo a Mystery Cuadros a publicar mi reseña{photo ? ", mi foto" : ""} y mi nombre (solo nombre e
          inicial del apellido) en mysterycuadros.com. Puedo pedir que la retiren cuando quiera.
        </span>
      </label>
      {photo && !consent && (
        <p className="-mt-3 text-xs text-amber-700">Sin esta autorización tu foto no se guarda.</p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting || photoBusy}
        className="w-full rounded-full bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSubmitting ? "Enviando..." : "Enviar reseña"}
      </button>
    </form>
  );
}
