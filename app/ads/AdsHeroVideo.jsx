"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

// Hero de /ads (nov 2026): el póster es el elemento LCP. Con <video
// autoPlay preload="auto"> el navegador bajaba los 248 KB del video al
// mismo tiempo que el póster y el JS, y en 4G lenta el póster se pintaba
// recién a los ~3,8 s. Ahora el póster es una imagen normal con prioridad
// alta y el video se monta encima recién cuando la página terminó de
// cargar; aparece con un fundido cuando ya puede reproducirse, así que
// nunca hay un cuadro en blanco.
export default function AdsHeroVideo({ poster, src, label }) {
  const [montarVideo, setMontarVideo] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const montar = () => setMontarVideo(true);
    if (document.readyState === "complete") {
      montar();
      return undefined;
    }
    window.addEventListener("load", montar, { once: true });
    return () => window.removeEventListener("load", montar);
  }, []);

  return (
    <>
      <Image
        src={poster}
        alt={label}
        fill
        priority
        unoptimized
        sizes="256px"
        className="object-cover"
      />
      {montarVideo && (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onCanPlay={() => setListo(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${listo ? "opacity-100" : "opacity-0"}`}
          aria-hidden="true"
        >
          <source src={src} type="video/mp4" />
        </video>
      )}
    </>
  );
}
