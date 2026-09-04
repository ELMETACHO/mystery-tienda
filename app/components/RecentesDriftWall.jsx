"use client";

import { useEffect, useState } from "react";
import DriftWall from "./DriftWall";

// Fotos reales de catálogo (public/images/catalogo/) en vez de los
// placeholders de picsum.photos que trae DriftWall por defecto.
const RECIENTES_IMAGES = [
  "/images/catalogo/07c814769f3e833dfa099eab263f40d7.jpg",
  "/images/catalogo/1f15aefea2972296115e106a6fb2b10d.jpg",
  "/images/catalogo/60b4517715cdbdcad514eb25eb0d23a3.jpg",
  "/images/catalogo/7767937dd7ee0a6ece2649ee09e6b5b8.jpg",
  "/images/catalogo/7e2ad6cc1d5eddfad75334883498ed9e.jpg",
  "/images/catalogo/8addbd0a158fda8fec74aef1c3b88e2d.jpg",
  "/images/catalogo/8d870c2077731fa12a69accc65250be8.jpg",
  "/images/catalogo/f93ce9c3f6875843003615e4138fa99e.jpg",
  "/images/catalogo/IMG_7334.JPG",
  "/images/catalogo/IMG_7336.PNG",
  "/images/catalogo/IMG_7337.PNG",
  "/images/catalogo/IMG_7338.JPG",
  "/images/catalogo/IMG_7339.PNG",
  "/images/catalogo/IMG_7340.JPG",
  "/images/catalogo/IMG_7341.JPG",
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
