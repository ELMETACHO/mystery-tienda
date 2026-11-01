"use client";

import { useEffect } from "react";
import { trackProductView } from "../../lib/gtm";

// Empuja view_item (ViewContent de Meta/TikTok vía GTM) una vez por vista
// de producto. No pinta nada ni hace peticiones: solo agrega el evento a la
// cola del dataLayer, que GTM procesa cuando carga.
export default function ProductViewTracker({ id, name, priceCOP }) {
  useEffect(() => {
    trackProductView({ id, name, priceCOP });
  }, [id, name, priceCOP]);
  return null;
}
