// /checkout es una página transaccional (formulario de datos + pago):
// sin contenido útil para buscadores y distinta para cada cliente, así que
// no debe indexarse. follow: true porque sus links (políticas, Home) son
// públicos. La página es un client component ("use client") y no puede
// exportar `metadata`, por eso vive en este layout mínimo — que además
// aplica a /checkout/confirmacion (ver su propio layout).
export const metadata = {
  title: "Finalizar compra — Mystery",
  robots: { index: false, follow: true },
};

export default function CheckoutLayout({ children }) {
  return children;
}
