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
export type TripGen = {
  generating: boolean;
  appending: boolean; // "generar más" en curso: conserva los looks + indicador inline
  genError: boolean;
  genNote: string | null;
  onGenerate: () => void; // generar/rehacer (reemplaza el set)
  onGenerateMore: () => void; // generar más (acumula combinaciones nuevas)
  onGenerateLooks: () => void; // CTA maleta: genera + cambia a la pestaña de looks
  onViewLooks: () => void; // CTA maleta: solo ir a los looks (ya existen)
  looksExist: boolean;
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
  looksExist: false,
};

export const TripGenContext = createContext<TripGen>(DEFAULT);
export const useTripGen = () => useContext(TripGenContext);
