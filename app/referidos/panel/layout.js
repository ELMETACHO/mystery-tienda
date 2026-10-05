// /referidos/panel es el panel privado de cada embajador (ventas,
// comisiones, pagos), protegido por código — nunca debe indexarse. La
// página pública e indexable es /referidos (esa sí está en el sitemap).
// Client component, por eso la metadata vive en este layout mínimo.
export const metadata = {
  title: "Panel de referidos — Mystery",
  robots: { index: false, follow: false },
};

export default function ReferidosPanelLayout({ children }) {
  return children;
}
