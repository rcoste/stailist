import { capsuleRows, type CapsuleMatch, type CapsuleOverrides, type CapsuleTarget } from "@/lib/capsule";
import { sustitutoDe } from "@/lib/trip-maleta";
import {
  coloresDe,
  elegirPrendas,
  fotoSegura,
  precioTexto,
  terminoDe,
  urlDeFicha,
  type Mercado,
  type Segmento,
  type UniqloItem,
} from "@/lib/vitrina-uniqlo";

// LA MEDICIÓN EN SECO DE LA VITRINA DE UNIQLO — la parte pura (2026-10-21).
//
// La vitrina (lib/vitrina-uniqlo.ts) elige sin IA: término + segmento + color
// + calificación. Roberto preguntó cómo saber si elige bien, y la respuesta de
// la casa es medirlo, no opinarlo. Esto arma el material de la medición:
//
//   1. `huecosDeViaje`: los huecos REALES de una maleta — la misma lista que
//      pinta la página del viaje (capsuleRows + "falta" + sin sustituto), con
//      el término con el que la vitrina buscaría cada uno.
//   2. `armarCandidatos`: los 20 que devolvió la API para un hueco y mercado,
//      con las DOS que la vitrina enseña marcadas (`elegirPrendas`, la función
//      de producción tal cual, no una copia) y, para las demás, POR QUÉ no las
//      eligió. El motivo no decide nada: explica. Si el juez o Roberto dicen
//      que un candidato descartado por "sin-color" era la pieza, la lección es
//      del diccionario de colores, no de la elección.
//   3. `resumenMedicion`: los tres números de la pantalla.
//
// Nada aquí toca la red ni la base: el script y la pantalla lo llaman.

export type HuecoMedicion = {
  itemIndex: number;
  segmento: Segmento;
  nombre: string;
  tipo: string;
  colorFamilia: string;
  temporada: string | null;
  formalidad: string | null;
  visual: string | null;
  porque: string | null;
  /** Con qué buscó la vitrina (terminoDe); null = no sabe buscar este tipo. */
  termino: string | null;
};

/**
 * Los huecos reales de una maleta: lo que falta y sigue en el plan (ni lo sacó
 * del viaje ni lo cubrió con un sustituto). Mismo filtro que la página del
 * viaje y que lib/trip-avisos.ts; si cambia allá, tiene que cambiar aquí.
 */
export function huecosDeViaje(
  target: CapsuleTarget,
  match: CapsuleMatch | null,
  overrides: CapsuleOverrides | null,
  segmento: Segmento
): HuecoMedicion[] {
  return capsuleRows(target, match, overrides)
    .filter((r) => !r.dismissed && r.effective === "falta" && !sustitutoDe(overrides, r.index))
    .map((r) => ({
      itemIndex: r.index,
      segmento,
      nombre: r.item.nombre,
      tipo: r.item.tipo,
      colorFamilia: r.item.colorFamilia,
      temporada: r.item.temporada ?? null,
      formalidad: r.item.formalidad ?? null,
      visual: r.item.visual ?? null,
      porque: r.item.porque ?? null,
      termino: terminoDe(r.item.tipo),
    }));
}

export type MotivoDescarte = "genero" | "sin-precio" | "sin-color" | "sin-foto" | "rating";

export type CandidatoMedicion = {
  mercado: Mercado;
  /** Posición en la respuesta de la API (0..19). */
  orden: number;
  productId: string;
  nombre: string;
  /** El color que se enseña: el de la familia si lo hay; si no, el primero del producto. */
  color: string | null;
  displayCode: string | null;
  genero: string | null;
  precio: number | null;
  precioTexto: string | null;
  foto: string | null;
  url: string;
  rating: number | null;
  elegida: boolean;
  motivo: MotivoDescarte | null;
};

/**
 * Por qué la vitrina NO elegiría este producto, en el orden en que
 * `elegirPrendas` filtra. null = pasa todos los filtros (y entonces quedó
 * fuera sólo por calificación, o quedó dentro).
 */
export function motivoDescarte(
  it: UniqloItem,
  hueco: { segmento: Segmento; colorFamilia: string }
): Exclude<MotivoDescarte, "rating"> | null {
  const generos = new Set([hueco.segmento === "hombre" ? "MEN" : "WOMEN", "UNISEX"]);
  if (!generos.has(it.genderCategory ?? "")) return "genero";
  if (typeof it.prices?.base?.value !== "number") return "sin-precio";
  const colores = coloresDe(hueco.colorFamilia);
  const color = (it.colors ?? []).find((c) => colores.includes((c.name ?? "").toUpperCase()));
  if (!color?.displayCode) return "sin-color";
  if (!fotoSegura(it.images?.main?.[color.displayCode]?.image)) return "sin-foto";
  return null;
}

/**
 * Los candidatos de un hueco en un mercado, tal cual los dio la API, con las
 * dos elegidas marcadas por la función de producción. Los productos sin id o
 * sin nombre se saltan: no hay nada que enseñar ni que juzgar.
 */
export function armarCandidatos(
  items: UniqloItem[] | null | undefined,
  hueco: { segmento: Segmento; colorFamilia: string },
  mercado: Mercado
): CandidatoMedicion[] {
  const elegidas = new Set(elegirPrendas(items, hueco, mercado).map((p) => p.id));
  const colores = coloresDe(hueco.colorFamilia);
  const salida: CandidatoMedicion[] = [];
  (items ?? []).forEach((it, orden) => {
    if (!it?.productId || !it.name) return;
    const enFamilia = (it.colors ?? []).find((c) => colores.includes((c.name ?? "").toUpperCase()));
    const color = enFamilia ?? (it.colors ?? [])[0] ?? null;
    const displayCode = color?.displayCode ?? null;
    const id = `${mercado}:${it.productId}:${displayCode ?? ""}`;
    const elegida = elegidas.has(id);
    const precio = typeof it.prices?.base?.value === "number" ? it.prices.base.value : null;
    const foto =
      fotoSegura(displayCode ? it.images?.main?.[displayCode]?.image : null) ??
      fotoSegura(Object.values(it.images?.main ?? {})[0]?.image) ??
      null;
    salida.push({
      mercado,
      orden,
      productId: it.productId,
      nombre: it.name,
      color: color?.name ? color.name.toUpperCase() : null,
      displayCode,
      genero: it.genderCategory ?? null,
      precio,
      precioTexto: precio === null ? null : precioTexto(mercado, precio),
      foto,
      url: urlDeFicha(mercado, it.productId, displayCode),
      rating: typeof it.rating?.average === "number" ? it.rating.average : null,
      elegida,
      motivo: elegida ? null : (motivoDescarte(it, hueco) ?? "rating"),
    });
  });
  return salida;
}

// --- Los números de la pantalla --------------------------------------------

export type VotoFila = {
  huecoN: number;
  elegida: boolean;
  juez: boolean | null;
  roberto: boolean | null;
};

export type ResumenMedicion = {
  /** De las que la vitrina enseña: cuántas calificó Roberto y cuántas aprobó. */
  elegidas: { total: number; votadas: number; aprobadas: number };
  /** Candidatos con los dos veredictos, y en cuántos coinciden. */
  acuerdo: { comparables: number; coinciden: number };
  /** Huecos con al menos un candidato correcto entre los 20 (× mercados). */
  techo: { roberto: number; juez: number; huecos: number; huecosSinVoto: number };
  calificados: { votados: number; total: number };
};

export function resumenMedicion(filas: VotoFila[], nHuecos: number): ResumenMedicion {
  const elegidas = filas.filter((f) => f.elegida);
  const comparables = filas.filter((f) => f.juez !== null && f.roberto !== null);
  const conSiRoberto = new Set<number>();
  const conSiJuez = new Set<number>();
  const conVoto = new Set<number>();
  for (const f of filas) {
    if (f.roberto !== null) conVoto.add(f.huecoN);
    if (f.roberto === true) conSiRoberto.add(f.huecoN);
    if (f.juez === true) conSiJuez.add(f.huecoN);
  }
  return {
    elegidas: {
      total: elegidas.length,
      votadas: elegidas.filter((f) => f.roberto !== null).length,
      aprobadas: elegidas.filter((f) => f.roberto === true).length,
    },
    acuerdo: {
      comparables: comparables.length,
      coinciden: comparables.filter((f) => f.juez === f.roberto).length,
    },
    techo: {
      roberto: conSiRoberto.size,
      juez: conSiJuez.size,
      huecos: nHuecos,
      huecosSinVoto: Math.max(0, nHuecos - conVoto.size),
    },
    calificados: { votados: filas.filter((f) => f.roberto !== null).length, total: filas.length },
  };
}

/** Porcentaje entero, o null si no hay con qué dividir. */
export function pct(n: number, de: number): number | null {
  return de > 0 ? Math.round((n / de) * 100) : null;
}
