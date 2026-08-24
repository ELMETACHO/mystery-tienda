"use client";

import { useState } from "react";

const ITEMS = [
  {
    key: "privacidad",
    label: "Política de privacidad",
    text: "Las imágenes que subes en /crear se usan únicamente para fabricar tu cuadro — nunca se comparten con otros clientes, no se conservan más allá del proceso de producción, ni tienen ningún otro uso. Solo guardamos tus datos de contacto básicos (nombre, teléfono, dirección, correo) para gestionar tu pedido.",
  },
  {
    key: "devoluciones",
    label: "Políticas de devolución",
    text: "Aceptamos devoluciones únicamente por defectos de fábrica o daños durante el transporte. Debes reportarlo dentro de los primeros días de recibido, adjuntando evidencia fotográfica — requisito de la transportadora. También aplica si el diseño llegó erróneo o con mala calidad de impresión: adjunta evidencia y lo solucionamos. El anticipo de $20.000 (pedidos contraentrega) no es reembolsable si el pedido no puede entregarse por ausencia repetida en la dirección indicada, tras varios intentos de la transportadora. Esto es distinto a pérdida o daño del producto durante el transporte, que sí está cubierto por nuestra garantía. Si eres cliente y deseas un nuevo intento, debes cubrir los costos del segundo envío.",
  },
  {
    key: "nosotros",
    label: "Sobre nosotros",
    text: "Somos una marca colombiana independiente, con más de 7 años produciendo cuadros decorativos personalizados. Ya hemos entregado más de 1.000 cuadros en todo el país. Trabajamos con vinilo laminado de alta calidad sobre madera, con acabados duraderos y diseño 100% personalizado.",
  },
];

// Fila de 3 botones (no links, no navegan a otra página) que despliegan su
// texto debajo — un único área de contenido compartida, como acordeón:
// tocar el mismo botón lo cierra, tocar otro reemplaza el contenido.
export default function FooterLegalAccordion() {
  const [openKey, setOpenKey] = useState(null);
  const active = ITEMS.find((item) => item.key === openKey);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
        {ITEMS.map((item, i) => (
          <span key={item.key} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpenKey((prev) => (prev === item.key ? null : item.key))}
              aria-expanded={openKey === item.key}
              className={`underline-offset-2 transition-colors ${
                openKey === item.key ? "text-accent-soft underline" : "hover:text-zinc-300 hover:underline"
              }`}
            >
              {item.label}
            </button>
            {i < ITEMS.length - 1 && <span aria-hidden="true">·</span>}
          </span>
        ))}
      </div>

      {active && (
        <p className="mx-auto mt-3 max-w-md text-left text-[11px] leading-relaxed text-zinc-500">
          {active.text}
        </p>
      )}
    </div>
  );
}
