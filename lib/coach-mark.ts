// Geometría del coach-mark (el tip que oscurece la pantalla y recorta el
// elemento del que te habla). Vive aparte del componente porque es la parte que
// FALLA, y fallar aquí no se ve como un tip mal puesto: se ve como que la app
// murió. El velo tapa todo, el scroll queda bloqueado y —si la nota cayó fuera
// de la pantalla— no hay nada que tocar.
//
// Es justo lo que reportó Alberto (2026-07-30): "al volver a mi cápsula la
// pantalla se puso negra y ya no puedo acceder aunque le di refresh". No se
// curaba al recargar porque el tip solo se marca visto cuando lo tocas.

export const PAD = 8; // aire entre el elemento real y el borde del recorte
export const GAP = 12; // separación entre el recorte y la nota
export const MARGEN = 16; // respiro mínimo contra los bordes de la pantalla

export type Caja = { top: number; left: number; width: number; height: number };

export type Colocacion = {
  left: number;
  top: number;
  /** Dónde va la punta de la nota, o null si no debe dibujarse. */
  punta: "arriba" | "abajo" | null;
  /** Posición horizontal de la punta, relativa al borde izquierdo de la nota. */
  puntaX: number;
};

export const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

/**
 * ¿Se ve lo suficiente como para que iluminarlo signifique algo?
 *
 * No exige que quepa entero —un card puede ser más alto que la pantalla—: basta
 * con que haya una franja real dentro y no una raya pegada al borde.
 */
export function enPantalla(r: Caja, vh: number): boolean {
  return r.top + r.height > MARGEN && r.top < vh - MARGEN;
}

/**
 * Dónde poner la nota respecto al elemento iluminado. Prefiere debajo; si no
 * cabe, encima; y pase lo que pase, NUNCA fuera de la pantalla.
 *
 * El clamp final no es paranoia: con un target abajo del fold el cálculo daba
 * un `top` de cientos de píxeles fuera de la vista, y el resultado era una
 * pantalla negra sin salida.
 */
export function colocarNota(
  rect: Caja,
  noteH: number,
  vw: number,
  vh: number,
  noteW: number
): Colocacion {
  const holeTop = rect.top - PAD;
  const holeBottom = rect.top + rect.height + PAD;
  // Centrada en el elemento, no alineada a su izquierda: con la punta, el
  // centro es lo que hace que se lea "te hablo de ESTO".
  const centroX = rect.left + rect.width / 2;
  const left = clamp(centroX - noteW / 2, MARGEN, Math.max(MARGEN, vw - noteW - MARGEN));

  const cabeAbajo = holeBottom + GAP + noteH + MARGEN <= vh;
  const cabeArriba = holeTop - GAP - noteH - MARGEN >= 0;

  let top: number;
  let punta: "arriba" | "abajo" | null;
  if (cabeAbajo || !cabeArriba) {
    top = holeBottom + GAP;
    punta = "arriba";
  } else {
    top = holeTop - GAP - noteH;
    punta = "abajo";
  }

  const topOk = clamp(top, MARGEN, Math.max(MARGEN, vh - noteH - MARGEN));
  // Si hubo que moverla, o si no cabía ni arriba ni abajo (elemento enorme), la
  // punta ya no apunta a nada: apuntar a un lugar equivocado confunde más que no
  // apuntar.
  if (topOk !== top || (!cabeAbajo && !cabeArriba)) punta = null;

  return {
    left,
    top: topOk,
    punta,
    puntaX: clamp(centroX - left, 18, noteW - 18),
  };
}
