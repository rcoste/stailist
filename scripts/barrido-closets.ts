// Los clósets del barrido: prendas REALES del catálogo, repartidas distinto a
// cada caso.
//
// POR QUÉ NO SE ESCRIBEN A MANO
// La primera versión los inventó: 15 "básicos" escritos a mano que, sin querer,
// no incluían UN SOLO top cálido. El barrido midió entonces que el motor
// "rompía la paleta tierra" el 30% de las veces — cuando lo que pasaba es que
// era imposible cumplirla con lo que se le dio. Una fixture inventada no mide el
// motor, mide la fixture.
//
// Ahora salen del catálogo real (tabla `archetypes`), el mismo del que la app
// arma el clóset de la gente.
//
// ALEATORIO PERO REPRODUCIBLE
// Cada caso recibe un sorteo distinto —así el barrido ve muchas combinaciones y
// no una sola foto— pero con semilla: la misma corrida da los mismos clósets, y
// un fallo se puede volver a producir. Aleatorio sin semilla es un barrido que
// no se puede depurar.
//
// VIABILIDAD MÍNIMA
// Un sorteo puro puede dejar a alguien con cinco zapatos y ninguna playera, y
// entonces se mide el sorteo, no el motor. Cada clóset garantiza un mínimo por
// categoría antes de rellenar al azar.

import { createClient } from "@supabase/supabase-js";
import type { EngineItem } from "../lib/engine/prompt";

/**
 * Generador con semilla (mulberry32). Determinista: misma semilla, mismo
 * clóset. Sin esto un fallo interesante del barrido no se puede reproducir.
 */
export function rng(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const barajar = <T,>(xs: T[], r: () => number) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

type Fila = {
  slug: string;
  name: string;
  category: string;
  attrs: EngineItem["attrs"];
  onboarding_subset: boolean;
};

export async function cargarCatalogo(genero: "hombre" | "mujer"): Promise<Fila[]> {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await s
    .from("archetypes")
    .select("slug,name,category,attrs,onboarding_subset")
    .in("segment", [genero, "unisex"]);
  if (error) throw new Error(error.message);
  return (data ?? []) as Fila[];
}

const aItem = (f: Fila): EngineItem => ({ id: f.slug, attrs: { ...f.attrs, nombre: f.name } });

// Mínimos para que un look sea posible. Sin esto el sorteo puede dejar a alguien
// sin nada que ponerse abajo y el barrido mediría eso, no el motor.
const MINIMOS: Record<string, number> = { top: 3, bottom: 3, calzado: 2 };

/**
 * Un clóset sorteado del catálogo real.
 *
 * `soloOnboarding` limita al checklist (lo que tiene TODA la gente nueva, el
 * caso más común del producto). Sin él entra el catálogo completo, que es el
 * clóset de alguien que ya lo pobló.
 */
export function sortearCloset(
  catalogo: Fila[],
  tamano: number,
  semilla: number,
  soloOnboarding: boolean
): EngineItem[] {
  const r = rng(semilla);
  const fuente = soloOnboarding ? catalogo.filter((f) => f.onboarding_subset) : catalogo;
  const elegidas: Fila[] = [];
  const vistos = new Set<string>();

  // Primero los mínimos por categoría, luego relleno libre.
  for (const [cat, n] of Object.entries(MINIMOS)) {
    for (const f of barajar(fuente.filter((x) => x.category === cat), r).slice(0, n)) {
      elegidas.push(f);
      vistos.add(f.slug);
    }
  }
  for (const f of barajar(fuente, r)) {
    if (elegidas.length >= tamano) break;
    if (vistos.has(f.slug)) continue;
    elegidas.push(f);
    vistos.add(f.slug);
  }
  return elegidas.map(aItem);
}

/**
 * El clóset HOSTIL: el único que sigue siendo a mano, y a propósito.
 *
 * Su gracia es carecer de cosas —nada formal, nada de abrigo, nada cálido— para
 * medir la pregunta incómoda: ¿la receta se adapta a lo que hay, o empuja hacia
 * prendas que no existen y saca un look a medias? Sortearlo del catálogo le
 * quitaría justo eso.
 */
export function closetHostil(catalogo: Fila[], semilla: number): EngineItem[] {
  const r = rng(semilla);
  const pobre = catalogo.filter(
    (f) =>
      f.attrs.formalidad !== "formal" &&
      f.attrs.temporada !== "frio" &&
      !/saco|blazer|abrigo|gabardina|traje|mocas|zapato/i.test(f.name)
  );
  return sortearCloset(pobre, 10, Math.floor(r() * 1e6), false);
}
