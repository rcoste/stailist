import { capsuleRows, type CapsuleMatch, type CapsuleOverrides, type CapsuleTarget } from "@/lib/capsule";
import { sustitutoDe } from "@/lib/trip-maleta";
import {
  colorQueEmpata,
  coloresDe,
  cuelloCompatible,
  elegirCercana,
  elegirPrendas,
  esRopaInterior,
  estampadoNoPedido,
  fotoSegura,
  funcionCompatible,
  mangaCompatible,
  mangaDe,
  materialCompatible,
  nombreCoincide,
  precioTexto,
  temporadaCompatible,
  terminoDe,
  textoDePieza,
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
  /** Ninguna parada pasa de 20 °C (viajeEsFrio); null si el viaje no tiene clima. */
  viajeFrio: boolean | null;
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
  segmento: Segmento,
  viajeFrio: boolean | null = null
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
      // Con el NOMBRE, igual que components/vitrina-hueco.tsx desde v0.2.402.2:
      // de ahí salen los modificadores ("Short de lino negro" → "linen shorts").
      termino: terminoDe(r.item.tipo, r.item.nombre),
      viajeFrio,
    }));
}

export type MotivoDescarte =
  | "genero"
  | "ropa-interior"
  | "nombre-no-coincide"
  | "manga"
  | "estampado"
  | "cuello"
  | "funcion"
  | "temporada"
  | "material"
  | "sin-precio"
  | "sin-color"
  | "tono"
  | "sin-foto"
  | "rating";

/** Lo que la vitrina necesita de un hueco para elegir (la firma de elegirPrendas). */
export type HuecoParaElegir = {
  segmento: Segmento;
  colorFamilia: string;
  termino?: string | null;
  nombre?: string | null;
  visual?: string | null;
  temporada?: string | null;
  viajeFrio?: boolean | null;
};

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
  /** true si es "la más cercana" (se enseña cediendo el tono porque no hubo exacta en este mercado). */
  cercana: boolean;
  tonoCercano: string | null;
};

/**
 * Por qué la vitrina NO elegiría este producto, en el orden en que
 * `elegirPrendas` filtra. null = pasa todos los filtros (y entonces quedó
 * fuera sólo por calificación, o quedó dentro).
 */
export function motivoDescarte(it: UniqloItem, hueco: HuecoParaElegir): Exclude<MotivoDescarte, "rating"> | null {
  const generos = new Set([hueco.segmento === "hombre" ? "MEN" : "WOMEN", "UNISEX"]);
  if (!generos.has(it.genderCategory ?? "")) return "genero";
  // Desde v0.2.402.2: ni ropa interior ni una ficha que no diga la prenda pedida.
  const termino = hueco.termino ?? "";
  if (esRopaInterior(it.name ?? "", termino)) return "ropa-interior";
  if (termino && !nombreCoincide(it.name ?? "", termino)) return "nombre-no-coincide";
  // Desde v0.2.402.3: manga, liso/estampado, cuello, función (lluvia), temporada y piel.
  const nombre = it.name ?? "";
  const pieza = textoDePieza(hueco); // nombre + descripción visual, como producción
  if (!mangaCompatible(nombre, mangaDe(pieza), termino)) return "manga";
  if (estampadoNoPedido(nombre, pieza)) return "estampado";
  if (!cuelloCompatible(nombre, pieza)) return "cuello";
  if (!funcionCompatible(nombre, pieza)) return "funcion";
  if (!temporadaCompatible(nombre, { ...hueco, nombre: pieza })) return "temporada";
  if (!materialCompatible(nombre, pieza)) return "material";
  if (typeof it.prices?.base?.value !== "number") return "sin-precio";
  // Misma puerta que producción: familia por nombre y, si la hay, tono por código.
  const { color, porNombre } = colorQueEmpata(it.colors, hueco);
  if (!color?.displayCode) return porNombre ? "tono" : "sin-color";
  if (!fotoSegura(it.images?.main?.[color.displayCode]?.image)) return "sin-foto";
  return null;
}

/**
 * Los candidatos de un hueco en un mercado, tal cual los dio la API, con las
 * dos elegidas marcadas por la función de producción. Los productos sin id o
 * sin nombre se saltan: no hay nada que enseñar ni que juzgar.
 */
export function armarCandidatos(items: UniqloItem[] | null | undefined, hueco: HuecoParaElegir, mercado: Mercado): CandidatoMedicion[] {
  const elegidas = new Set(elegirPrendas(items, hueco, mercado).map((p) => p.id));
  // La cercana sólo existe si en ESTE mercado no hubo exacta (la página además
  // exige que no la haya en ningún país; aquí se mide por mercado).
  const cercana = elegidas.size === 0 ? elegirCercana(items, hueco, mercado)[0] ?? null : null;
  const salida: CandidatoMedicion[] = [];
  (items ?? []).forEach((it, orden) => {
    if (!it?.productId || !it.name) return;
    // El color que se enseña: el que empata (familia y tono); si no, el primero
    // de la familia por nombre (para ver el tono que se descartó); si no, el primero.
    const colores = coloresDe(hueco.colorFamilia);
    const enFamilia = colorQueEmpata(it.colors, hueco).color ?? (it.colors ?? []).find((c) => colores.includes((c.name ?? "").toUpperCase()));
    let color = enFamilia ?? (it.colors ?? [])[0] ?? null;
    let displayCode = color?.displayCode ?? null;
    const esCercana = cercana?.productId === it.productId;
    if (esCercana) {
      // Se enseña en el color vecino, no en el primero de la familia.
      color = (it.colors ?? []).find((c) => c.displayCode === cercana!.colorCode) ?? color;
      displayCode = color?.displayCode ?? null;
    }
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
      cercana: esCercana,
      tonoCercano: esCercana ? (cercana?.cercana ?? null) : null,
    });
  });
  return salida;
}

// --- La muestra chica ------------------------------------------------------
//
// Roberto, al ver la corrida completa: "no hay manera de que yo me ponga a
// revisar 40 o 50 cosas; puede ser con 4 prendas y ya, e iteramos". La corrida
// de 58 huecos es para el juez; lo que él vota cabe en una pantalla. La muestra
// se elige a mano alzada pero determinista: tipos distintos entre sí y los dos
// segmentos alternados, para que cuatro huecos no sean cuatro suéteres.

export function muestraDeHuecos<H extends { tipo: string; segmento: Segmento; termino: string | null }>(huecos: H[], n: number): H[] {
  const salida: H[] = [];
  const tipos = new Set<string>();
  const conTermino = huecos.filter((h) => h.termino);
  let segmento: Segmento = "mujer";
  while (salida.length < n) {
    const sig =
      conTermino.find((h) => !salida.includes(h) && h.segmento === segmento && !tipos.has(h.tipo.split("-")[0])) ??
      conTermino.find((h) => !salida.includes(h) && !tipos.has(h.tipo.split("-")[0])) ??
      conTermino.find((h) => !salida.includes(h));
    if (!sig) break;
    salida.push(sig);
    tipos.add(sig.tipo.split("-")[0]);
    segmento = segmento === "mujer" ? "hombre" : "mujer";
  }
  return salida;
}

// --- Los números de la pantalla --------------------------------------------

export type VotoFila = {
  huecoN: number;
  elegida: boolean;
  /** "La más cercana": se mide aparte de las elegidas exactas. */
  cercana?: boolean;
  juez: boolean | null;
  roberto: boolean | null;
};

export type ResumenMedicion = {
  /** De las que la vitrina enseña: cuántas calificó Roberto y cuántas aprobó. */
  elegidas: { total: number; votadas: number; aprobadas: number };
  /** Las cercanas (ceden el tono): aparte, con su propia aprobación de Roberto. */
  cercanas: { total: number; votadas: number; aprobadas: number };
  /** Candidatos con los dos veredictos, y en cuántos coinciden. */
  acuerdo: { comparables: number; coinciden: number };
  /** Huecos con al menos un candidato correcto entre los 20 (× mercados). */
  techo: { roberto: number; juez: number; huecos: number; huecosSinVoto: number };
  calificados: { votados: number; total: number };
};

export function resumenMedicion(filas: VotoFila[], nHuecos: number): ResumenMedicion {
  const elegidas = filas.filter((f) => f.elegida);
  const cercanas = filas.filter((f) => f.cercana);
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
    cercanas: {
      total: cercanas.length,
      votadas: cercanas.filter((f) => f.roberto !== null).length,
      aprobadas: cercanas.filter((f) => f.roberto === true).length,
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
