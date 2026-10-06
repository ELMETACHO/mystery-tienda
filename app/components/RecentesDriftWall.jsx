"use client";

import { useEffect, useState } from "react";
import DriftWall from "./DriftWall";

// Fotos reales de catálogo en vez de los placeholders de picsum.photos que
// trae DriftWall por defecto. Se usan versiones WebP 320×224 recortadas al
// formato de la tesela (public/images/catalogo/drift/*-320.webp, ~116KB en
// total) en vez de los originales JPG/PNG de hasta 1320×2327 (~4.2MB) que
// se mostraban a ~130px. Los originales siguen en public/images/catalogo/.
const RECIENTES_IMAGES = [
  "/images/catalogo/drift/07c814769f3e833dfa099eab263f40d7-320.webp",
  "/images/catalogo/drift/1f15aefea2972296115e106a6fb2b10d-320.webp",
  "/images/catalogo/drift/60b4517715cdbdcad514eb25eb0d23a3-320.webp",
  "/images/catalogo/drift/7767937dd7ee0a6ece2649ee09e6b5b8-320.webp",
  "/images/catalogo/drift/7e2ad6cc1d5eddfad75334883498ed9e-320.webp",
  "/images/catalogo/drift/8addbd0a158fda8fec74aef1c3b88e2d-320.webp",
  "/images/catalogo/drift/8d870c2077731fa12a69accc65250be8-320.webp",
  "/images/catalogo/drift/f93ce9c3f6875843003615e4138fa99e-320.webp",
  "/images/catalogo/drift/IMG_7334-320.webp",
  "/images/catalogo/drift/IMG_7336-320.webp",
  "/images/catalogo/drift/IMG_7337-320.webp",
  "/images/catalogo/drift/IMG_7338-320.webp",
  "/images/catalogo/drift/IMG_7339-320.webp",
  "/images/catalogo/drift/IMG_7340-320.webp",
  "/images/catalogo/drift/IMG_7341-320.webp",
];

const DRIFT_ITEMS = RECIENTES_IMAGES.map((src, i) => ({
  image: src,
  title: `Cuadro Mystery ${i + 1}`,
}));

// DriftWall necesita el número de columnas como valor de JS (no solo CSS),
// así que este wrapper cliente decide 3 columnas en móvil / 5 en desktop
// según el viewport, y le da al lienzo una altura fija (DriftWall llena
// 100% del alto de su contenedor).
export default function RecentesDriftWall() {
  const [columns, setColumns] = useState(3);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setColumns(mq.matches ? 5 : 3);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div className="h-[340px] w-full overflow-hidden rounded-2xl border border-black/10 shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)] sm:h-[440px]">
      <DriftWall
        items={DRIFT_ITEMS}
        columns={columns}
        tileWidth={columns === 3 ? 130 : 170}
        tileHeight={columns === 3 ? 92 : 116}
        gap={14}
        speed={28}
        variance={0.4}
        parallax={0.45}
        lift={48}
        fade={0.55}
        overlayColor="#fffaf0"
      />
    </div>
  );
}
