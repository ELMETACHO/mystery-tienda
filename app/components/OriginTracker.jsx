"use client";

import { useEffect } from "react";
import { recordLanding } from "../lib/attribution";

// Invisible: registra de dónde llegó el cliente (ver app/lib/attribution.js).
// Corre una sola vez por carga de documento, después de pintar, sin red y
// sin librerías — el cliente no nota nada.
export default function OriginTracker() {
  useEffect(() => {
    recordLanding();
  }, []);
  return null;
}
