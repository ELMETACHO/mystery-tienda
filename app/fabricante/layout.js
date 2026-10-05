// /fabricante es el panel interno del fabricante (pedidos, guías,
// inventario), protegido por código de acceso — nunca debe indexarse. La
// página es un client component ("use client") y no puede exportar
// `metadata`, por eso la metadata vive en este layout mínimo. Mismo
// tratamiento que /admin y /estudio.
export const metadata = {
  title: "Fabricante — Mystery",
  robots: { index: false, follow: false },
};

export default function FabricanteLayout({ children }) {
  return children;
}
