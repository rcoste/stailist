"use client";

import { useEffect } from "react";
import { instalarVigia } from "@/lib/avisar-error";

/** Instala el vigía de errores una vez (ver lib/avisar-error.ts). No pinta nada. */
export function VigiaErrores() {
  useEffect(() => {
    instalarVigia();
  }, []);
  return null;
}
