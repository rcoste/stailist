"use client";

import { createContext, useContext } from "react";

// Estado + callbacks de la generación de looks del viaje. Vive en TripTabs (dueño
// único: lo comparten el CTA de la maleta y los botones de looks) y se reparte por
// CONTEXT, no por cloneElement. Por qué: page.tsx (server component) pasa
// <TripResult/> y <TripOutfits/> como props a TripTabs (client); al cruzar la
// frontera RSC esos elementos dejan de ser "elementos válidos" para
// isValidElement, así que cloneElement los ignoraba y NINGÚN callback se inyectaba
// (botones muertos: "Rehacer", "Generar más", "Generar mis looks"). El context sí
// fluye por posición en el árbol, aunque el elemento venga serializado del server.
/** Las 4 pestañas del detalle (handoff viaje 2): el plan · prendas · empacar · looks. */
export type TripTab = "plan" | "prendas" | "empacar" | "looks";

export type TripGen = {
  generating: boolean;
  appending: boolean; // "generar más" en curso: conserva los looks + indicador inline
  genError: boolean;
  genNote: string | null;
  onGenerate: () => void; // generar/rehacer (reemplaza el set)
  onGenerateMore: () => void; // generar más (acumula combinaciones nuevas)
  onGenerateLooks: () => void; // CTA de empacar: genera + cambia a la pestaña de looks
  onViewLooks: () => void; // solo ir a los looks (ya existen)
  onViewMaleta: () => void; // candado de looks: volver a prendas, donde se revisa
  looksExist: boolean;
  /** La pestaña activa: TripResult la lee para saber qué fase pintar (prendas
   *  = revisar, empacar = checklist) sin desmontarse entre las dos. */
  tab: TripTab;
  goTo: (tab: TripTab) => void;
  /** true = la revisión ya se cerró ("listo — a empacar", o looks generados
   *  en viajes de antes del flujo nuevo). */
  confirmado: boolean;
  /** "✓ listo — a empacar": marca confirmado (optimista + server) y brinca a empacar. */
  onConfirm: () => void;
};

const noop = () => {};
const DEFAULT: TripGen = {
  generating: false,
  appending: false,
  genError: false,
  genNote: null,
  onGenerate: noop,
  onGenerateMore: noop,
  onGenerateLooks: noop,
  onViewLooks: noop,
  onViewMaleta: noop,
  looksExist: false,
  tab: "plan",
  goTo: noop,
  confirmado: false,
  onConfirm: noop,
};

export const TripGenContext = createContext<TripGen>(DEFAULT);
export const useTripGen = () => useContext(TripGenContext);
