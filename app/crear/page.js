import CrearFlow from "../components/CrearFlow";

export const metadata = {
  title: "Personaliza tu Cuadro con tu Propia Foto | Mystery Cuadros",
  description:
    "Sube tu foto, ajústala dentro del marco y elige el tamaño. Imprimimos tu cuadro en vinilo sobre madera y te lo enviamos gratis a toda Colombia.",
};

export default function CrearPage() {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[#8fcaf0] text-[#1b2a4a]">
      {/* Mismo fondo fijo del Home (ver app/page.js): la foto de cielo no
          se mueve con el scroll, position:fixed en vez de
          background-attachment:fixed por confiabilidad en iOS. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/walls/fondo-cielo-2.webp)" }}
      />
      <div className="relative z-10 flex flex-1 flex-col">
        <CrearFlow />
      </div>
    </div>
  );
}
