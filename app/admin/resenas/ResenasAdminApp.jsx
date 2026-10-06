"use client";

import { useEffect, useState } from "react";

const STATUS_LABEL = {
  pending: "Pendiente",
  approved: "Publicada",
  rejected: "Rechazada",
  legacy: "Antigua (sin consentimiento)",
};

const STATUS_STYLE = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
  legacy: "bg-zinc-100 text-zinc-600",
};

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Moderación de reseñas (/admin/resenas). Nada se publica sin pasar por
// acá: las reseñas nuevas llegan "Pendiente" y solo "Publicada" aparece
// en el Home, /ads y /producto (y en el JSON-LD de Google).
export default function ResenasAdminApp() {
  const [reviews, setReviews] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setError("");
    try {
      const res = await fetch("/api/admin-reviews", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar la lista");
      setReviews(data.reviews);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la lista de reseñas.");
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial (fetch) al montar; el setState es intencional
    load();
  }, []);

  const moderate = async (id, action) => {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/admin-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar el cambio");
      setReviews((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: data.status, hasPhoto: data.status === "rejected" ? false : r.hasPhoto } : r
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const counts = (reviews || []).reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
  const visible = (reviews || []).filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <div>
        <a href="/admin" className="text-sm text-accent hover:underline">
          ← Admin
        </a>
        <h1 className="mt-2 font-heading text-xl font-bold tracking-tight sm:text-2xl">Reseñas</h1>
        <p className="mt-1 text-sm text-[#33456b]">
          Solo las reseñas <strong>Publicadas</strong> (y con autorización del cliente) se muestran en la web.
          Rechazar borra la foto.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["pending", "approved", "rejected", "legacy", "all"].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === key ? "bg-accent text-white" : "bg-[#fffaf0] text-[#1b2a4a]"
            }`}
          >
            {key === "all" ? "Todas" : STATUS_LABEL[key]}
            {key !== "all" && counts[key] ? ` (${counts[key]})` : ""}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {reviews === null && !error && <p className="text-sm text-[#33456b]">Cargando…</p>}
      {reviews !== null && visible.length === 0 && (
        <p className="rounded-2xl bg-[#fffaf0] p-5 text-sm text-[#33456b]">No hay reseñas en esta lista.</p>
      )}

      <div className="flex flex-col gap-4">
        {visible.map((r, i) => (
          <div
            key={r.id || `${r.reference}-${i}`}
            className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-[#fffaf0] p-5 shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)] sm:flex-row"
          >
            {r.hasPhoto && r.id && (
              // eslint-disable-next-line @next/next/no-img-element -- foto privada servida por /api/review-photo (sin optimizador)
              <img
                src={`/api/review-photo/${r.id}`}
                alt="Foto enviada por el cliente"
                loading="lazy"
                className="h-40 w-40 shrink-0 rounded-xl object-cover"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLE[r.status] || ""}`}>
                  {STATUS_LABEL[r.status] || r.status}
                </span>
                <span className="text-accent">{"★".repeat(r.rating || 0)}</span>
                <span className="text-[#5b6b8c]">{formatDate(r.submittedAt)}</span>
              </div>
              <p className="whitespace-pre-line break-words text-sm text-[#1b2a4a]">
                {r.comment || <em className="text-[#5b6b8c]">(sin comentario)</em>}
              </p>
              <p className="text-xs text-[#5b6b8c]">
                {r.displayName || "—"}
                {r.sizeLabel ? ` · ${r.sizeLabel}` : ""} · Ref. {r.reference}
                {r.productId ? ` · producto ${r.productId}` : " · foto propia (/crear)"}
              </p>
              <p className="text-xs text-[#5b6b8c]">
                {r.consent ? "✅ Autorizó publicar su reseña y foto" : "🔒 No autorizó publicar (solo uso interno)"}
              </p>
              {r.id && (
                <div className="mt-2 flex gap-2">
                  {r.consent && r.status !== "approved" && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => moderate(r.id, "approve")}
                      className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                    >
                      Publicar
                    </button>
                  )}
                  {r.status !== "rejected" && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => moderate(r.id, "reject")}
                      className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-red-700 ring-1 ring-red-200 disabled:opacity-40"
                    >
                      {r.status === "approved" ? "Despublicar" : "Rechazar"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
