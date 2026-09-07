import { SITE_URL } from "../lib/siteUrl";
import ReferidosClient from "./ReferidosClient";

export const metadata = {
  title: "Gana Dinero Recomendando Mystery — Programa de Referidos",
  description:
    "Únete al equipo de embajadores Mystery: comparte tu código, tus clientes reciben descuento y tú ganas comisión por cada cuadro vendido.",
  alternates: { canonical: `${SITE_URL}/referidos` },
};

export default function ReferidosPage() {
  return <ReferidosClient />;
}
