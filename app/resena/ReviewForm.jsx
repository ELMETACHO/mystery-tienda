"use client";

import { useState } from "react";

export default function ReviewForm({ reference, token }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

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
        body: JSON.stringify({ ref: reference, token, rating, comment }),
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
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center">
        <p className="text-2xl">🎉</p>
        <p className="text-lg font-semibold text-zinc-100">¡Gracias por tu reseña!</p>
        <p className="text-sm text-zinc-400">Nos ayuda mucho a seguir mejorando.</p>
      </div>
    );
  }

  const displayRating = hoverRating || rating;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/5 px-6 py-8"
    >
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-zinc-300">¿Cuántas estrellas le das a tu cuadro?</p>
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
              <span className={value <= displayRating ? "text-accent-soft" : "text-zinc-600"}>★</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="review-comment" className="text-sm text-zinc-300">
          Comentario (opcional)
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Cuéntanos qué te pareció tu cuadro..."
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSubmitting ? "Enviando..." : "Enviar reseña"}
      </button>
    </form>
  );
}
