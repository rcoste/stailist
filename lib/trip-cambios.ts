// LO QUE ENSEÑAN LOS CAMBIOS DE PRENDA DE UN VIAJE ("no me convence — cámbiala").
//
// Cada cambio deja un evento `trip_item_swap` {ideal, from, to, trip_id, index}.
// Aquí se leen de dos maneras, las dos puras (sin base) para poder probarlas:
//
//  · anterioresDelLugar: las prendas que ya ocuparon ESTE lugar de ESTE viaje,
//    para ofrecer "la que tenías antes" sin pedirle nada a la IA.
//  · rechazadasNetas: lo que de verdad no quiso, para que los viajes nuevos no
//    se lo vuelvan a proponer.
//
// POR QUÉ "NETAS" (2026-11-12). La memoria contaba como rechazada cada prenda
// que alguna vez salió de un lugar. Pero cambiar no siempre es rechazar: hay
// quien prueba. Una noche real: 8 cambios del mismo par de zapatos en 5
// minutos, yendo y viniendo entre los mismos tenis. Con la regla vieja, sus
// zapatos favoritos quedaban "rechazados" y la siguiente versión del viaje los
// esquivaba. Ahora una prenda sólo cuenta si:
//   1. la app se la PROPUSO y él la quitó (lo que él mismo eligió y luego
//      cambió es explorar, no rechazar), y
//   2. su último movimiento fue salir: si después la volvió a elegir, no.

export type CambioViaje = {
  ideal?: string | null;
  from?: string | null;
  to?: string | null;
  trip_id?: string | null;
  /** Desde 2026-11-12. Los eventos viejos no lo traen: se casan sólo por `ideal`. */
  index?: number | null;
};

const limpio = (s: string | null | undefined) => (s ?? "").trim();

/**
 * Las prendas que ya estuvieron en este lugar, de la más reciente a la más
 * vieja, sin repetir. `cambios` viene del más reciente al más viejo y ya
 * filtrado a este viaje. Un lugar es su pieza ideal: si "cambiar la pieza"
 * puso otra ideal, la historia de la anterior ya no aplica, y sola deja de
 * casar. Quien llama descarta la que lleva hoy, las que ocupan otro lugar y
 * las que ya no están en su clóset.
 */
export function anterioresDelLugar(
  cambios: CambioViaje[],
  lugar: { ideal: string; index: number }
): string[] {
  const ideal = limpio(lugar.ideal);
  const salida: string[] = [];
  for (const c of cambios) {
    if (limpio(c.ideal) !== ideal) continue;
    if (typeof c.index === "number" && c.index !== lugar.index) continue;
    for (const n of [limpio(c.to), limpio(c.from)]) {
      if (n && !salida.includes(n)) salida.push(n);
    }
  }
  return salida;
}

/**
 * Las prendas que rechazó de verdad, de la más reciente a la más vieja.
 * `cambios` viene del más reciente al más viejo (todos sus viajes).
 */
export function rechazadasNetas(
  cambios: CambioViaje[],
  anclas: Set<string> = new Set(),
  tope = 8
): string[] {
  // 1. ¿Cuál fue la propuesta de la app en cada lugar? El `from` del PRIMER
  //    cambio de ese lugar en ese viaje. Lo que salió después lo había puesto
  //    él. Sin viaje (eventos de antes de 2026-07) no hay cómo saberlo: cuenta
  //    como propuesta, que era la regla de entonces.
  const propuestas = new Set<string>();
  const lugaresVistos = new Set<string>();
  for (let i = cambios.length - 1; i >= 0; i--) {
    const c = cambios[i];
    const from = limpio(c.from);
    if (!from) continue;
    if (!c.trip_id) {
      propuestas.add(from);
      continue;
    }
    // Por la pieza ideal y no por `index`: los eventos viejos no traen índice,
    // y mezclar las dos llaves partiría un mismo lugar en dos "primeros".
    const lugar = `${c.trip_id}|${limpio(c.ideal)}`;
    if (lugaresVistos.has(lugar)) continue;
    lugaresVistos.add(lugar);
    propuestas.add(from);
  }
  // 2. El último movimiento de cada prenda manda: salir = rechazo; entrar = no.
  const ultimo = new Map<string, "sale" | "entra">();
  for (const c of cambios) {
    const to = limpio(c.to);
    const from = limpio(c.from);
    if (to && !ultimo.has(to)) ultimo.set(to, "entra");
    if (from && !ultimo.has(from)) ultimo.set(from, "sale");
  }
  const salida: string[] = [];
  for (const [nombre, mov] of ultimo) {
    if (mov !== "sale" || !propuestas.has(nombre)) continue;
    // Un ancla gana sobre un rechazo viejo: si hoy la pidió, no es rechazada.
    if (anclas.has(nombre.toLowerCase())) continue;
    salida.push(nombre);
    if (salida.length >= tope) break;
  }
  return salida;
}
