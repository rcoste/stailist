"use client";

import { useEffect, useState } from "react";

// SUGERENCIAS DE LUGAR mientras escribes (Open-Meteo geocoding, público con
// CORS, debounced a 280ms).
//
// VIVÍA DENTRO DE trip-wizard Y SÓLO EL VIAJE LO TENÍA. El wizard de outfit
// pedía la ciudad con un campo de texto y un botón "buscar": escribías el
// nombre completo, le picabas, y si no acertabas te devolvía "no encontré esa
// ciudad — inténtalo con el nombre completo". Dos experiencias distintas para
// la misma pregunta, contra la MISMA API.
//
// Roberto lo cazó usándolo: "en la parte de otra ciudad no tenemos el
// autocomplete, igual que lo tenemos en el de viaje, lo cual hace que esté
// raro". Es el mismo patrón que ya costó caro con el vocabulario de prendas
// duplicado: la copia peor es la que la gente ve.
//
// La búsqueda NO se bloquea si falla: sin sugerencias, lo escrito a mano sigue
// valiendo — que es la promesa del campo.

// ---- Sugerencias de lugar (Open-Meteo geocoding, público con CORS, debounced) ----
export type Sugerencia = { nombre: string; tipo: "ciudad" | "pais"; label: string };
export function usePlaceSuggestions(draft: string): Sugerencia[] {
  const [sugs, setSugs] = useState<Sugerencia[]>([]);
  useEffect(() => {
    const q = draft.trim();
    const t = setTimeout(async () => {
      if (q.length < 2) {
        setSugs([]);
        return;
      }
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            q
          )}&count=5&language=es&format=json`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (!res.ok) return;
        const data = await res.json();
        const results = (data?.results ?? []) as {
          name: string;
          admin1?: string;
          country?: string;
          feature_code?: string;
        }[];
        setSugs(
          results.map((r) => {
            const esPais = (r.feature_code ?? "").startsWith("PCL") || r.country === r.name;
            return {
              nombre: r.name,
              tipo: esPais ? "pais" : "ciudad",
              label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
            };
          })
        );
      } catch {
        /* sin sugerencias — el usuario puede escribir a mano */
      }
    }, 280);
    return () => clearTimeout(t);
  }, [draft]);
  return sugs;
}
