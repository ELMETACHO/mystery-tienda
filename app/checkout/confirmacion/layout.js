// Confirmación de pedido: página personal post-pago, sin valor para
// buscadores — noindex. El layout de /checkout ya la cubre, pero se deja
// explícito acá (con su propio título) para que no dependa de la
// herencia si algún día se reorganizan las rutas. Client component, por
// eso la metadata vive en un layout.
export const metadata = {
  title: "Pedido confirmado — Mystery",
  robots: { index: false, follow: true },
};

export default function ConfirmacionLayout({ children }) {
  return children;
}
