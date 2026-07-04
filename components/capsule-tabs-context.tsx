"use client";

import { createContext } from "react";

// Deja que un CTA dentro de la lista de la cápsula (ej. "~N looks") cambie a la
// pestaña "tus looks" sin navegar. Mismo patrón que TripGenContext del viaje: el
// nodo llega como prop desde un server component y el context sí lo alcanza al
// cruzar la frontera RSC (cloneElement no funcionaría ahí).
export type CapsuleTabsCtx = { onViewLooks: () => void };

export const CapsuleTabsContext = createContext<CapsuleTabsCtx>({
  onViewLooks: () => {},
});
