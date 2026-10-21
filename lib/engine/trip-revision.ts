// EL JUEZ DE LA MALETA (2026-10-18). La cápsula tenía uno (reglas de código,
// lib/engine/capsule-revision.ts); la maleta no tenía ninguno, y la de una
// persona real salió para mínimas de 0°C con una parka impermeable, un bomber
// y un chaleco como únicos abrigos. Mismo principio: reglas comprobables
// contra el dato (clima por parada, ocasiones, equipaje), no opiniones de
// estilo. Cada regla se midió en seco contra las maletas guardadas antes de
// quedarse.

import type { CapsuleItem } from "@/lib/capsule";
import { FRIO_DE_ABRIGO, CALOR_DE_LIGERO } from "@/lib/engine/trip-capsule";
import { CAPACIDAD_HOLGADA } from "@/lib/trip";
import { hayLluvia } from "@/lib/weather";
import { esAbrigoDeInvierno, esCalzadoCerrado, esCapaExterior, esLigera, esParaLluvia, esPrendaBase } from "@/lib/engine/piezas-tipo";
import type { HallazgoCapsula } from "@/lib/engine/capsule-revision";

export type ClimaParada = { lugar?: string; temp_c: number; temp_min?: number; temp_max?: number; condition?: string | null };

export type ContextoMaleta = {
  paradas: ClimaParada[];
  ocasiones: string[];
  dias: number;
  /** Techo de prendas del equipaje (lib/trip.ts luggageCapacity); 0 = no se sabe. */
  capacidad: number;
  /** Prendas base que pide el viaje (lib/trip.ts capsuleFloor().base). Sin el dato, la regla no opina. */
  base?: number;
};

export function revisarMaleta(items: CapsuleItem[], ctx: ContextoMaleta): HallazgoCapsula[] {
  const v: HallazgoCapsula[] = [];
  const conClima = ctx.paradas.filter((p) => typeof p.temp_c === "number");
  const minima = conClima.length ? Math.min(...conClima.map((p) => p.temp_min ?? p.temp_c)) : null;
  const maxima = conClima.length ? Math.max(...conClima.map((p) => p.temp_max ?? p.temp_c)) : null;
  const fria = conClima.find((p) => (p.temp_min ?? p.temp_c) === minima);

  // 1. ABRIGO SEGÚN LA MÍNIMA de la parada más fría.
  if (minima !== null && minima <= FRIO_DE_ABRIGO && !items.some(esAbrigoDeInvierno)) {
    v.push({ regla: "sin-abrigo-para-la-minima", detalle: `La mínima del viaje es ~${minima}°C${fria?.lugar ? ` (${fria.lugar})` : ""} y la maleta no trae un abrigo de invierno de verdad.` });
  } else if (minima !== null && minima <= 12 && !items.some(esCapaExterior)) {
    v.push({ regla: "sin-capa-para-la-minima", detalle: `La mínima del viaje es ~${minima}°C y la maleta no trae ninguna capa (chamarra, gabardina, blazer, cárdigan).` });
  }

  // 2. CALZADO Y CAPAS PARA CADA PARADA: con frío, calzado cerrado; con una
  //    parada fría Y una calurosa, también piezas para el calor (dos bloques).
  if (minima !== null && minima <= 8 && !items.some(esCalzadoCerrado)) {
    v.push({ regla: "sin-calzado-cerrado", detalle: `Hay una parada fría (~${minima}°C) y todo el calzado es abierto.` });
  }
  if (minima !== null && maxima !== null && maxima >= CALOR_DE_LIGERO && minima <= 12 && !items.some(esLigera)) {
    v.push({ regla: "sin-bloque-de-calor", detalle: `El viaje va de ~${minima}°C a ~${maxima}°C y no hay piezas ligeras para la parada calurosa.` });
  }

  // 3. LLUVIA en alguna parada.
  const lluviosa = ctx.paradas.find((p) => hayLluvia(p.condition));
  if (lluviosa && !items.some(esParaLluvia)) {
    v.push({ regla: "sin-lluvia", detalle: `${lluviosa.lugar ? `En ${lluviosa.lugar}` : "En el viaje"} se espera lluvia y no hay nada que la aguante.` });
  }

  // 4. ALGO FORMAL si el viaje es de trabajo o formal.
  if (ctx.ocasiones.includes("trabajo") && !items.some((i) => i.formalidad === "formal")) {
    v.push({ regla: "sin-formal", detalle: `El viaje incluye "trabajo o formal" y no hay ninguna pieza formal.` });
  }

  // 5. PRENDAS BASE SUFICIENTES (2026-10-21): camisas, playeras, polos, lo que
  //    va pegado a la piel. Los suéteres se repiten; esto no. Su maleta de 8
  //    días traía 5 y cumplía el piso de "tops" con los suéteres.
  const base = items.filter(esPrendaBase).length;
  if (typeof ctx.base === "number" && ctx.base > 0 && base < ctx.base) {
    v.push({ regla: "pocas-base", detalle: `La maleta trae ${base} ${base === 1 ? "prenda base" : "prendas base"} (camisas, playeras, blusas: lo que va pegado a la piel) para ${ctx.dias} días y el viaje pide ${ctx.base}. Los suéteres no cuentan: se repiten.` });
  }

  // 6. QUE QUEPA en el equipaje, cuando el equipaje sí limita (mochila o mano).
  const ropa = items.filter((i) => i.category !== "accesorio").length;
  if (ctx.capacidad > 0 && ctx.capacidad < CAPACIDAD_HOLGADA && ropa > ctx.capacidad) {
    v.push({ regla: "no-cabe", detalle: `Son ${ropa} prendas para un equipaje de ~${ctx.capacidad}.` });
  }

  return v;
}
