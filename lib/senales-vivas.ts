// ¿QUÉ SEÑAL DEJÓ DE LLEGAR?
//
// POR QUÉ EXISTE, con los dos casos que lo pidieron, ambos encontrados el mismo
// fin de semana y por casualidad:
//
//   · el precalentado de imágenes de esenciales llevaba dos semanas cancelándose
//     solo, pagando renders que se tiraban (v0.2.237.0);
//   · el fit check dejó de escribir `worn` —la señal de oro del experimento—
//     en cuanto se volvió su único escritor (v0.2.238.2).
//
// Los dos son el mismo tipo de fallo: código que no lanza, no pinta un error y
// simplemente deja de hacer su trabajo. Ninguna prueba lo caza, porque no hay
// nada roto que probar; lo que hay es algo que ya no ocurre.
//
// La forma de verlo es COMPARAR DOS CONTEOS que tienen que moverse juntos. Si
// hubo 24 fit checks y 0 "me lo puse", da igual no saber por qué: ya sabes que
// algo se rompió, que es la parte que costaba semanas.
//
// NO es monitoreo de verdad (no avisa solo, hay que mirar el panel). Es el
// piso: convierte "nadie se enteró" en "está a la vista de quien entre".

export type ParDeSenales = {
  /** Cómo se llama esto para quien mira el panel. */
  nombre: string;
  /** El evento que dispara: si esto pasó, lo otro tiene que pasar. */
  disparador: string;
  disparos: number;
  /** El evento que debería seguirle. */
  consecuencia: string;
  consecuencias: number;
  /**
   * DESDE CUÁNDO EXISTE EL VÍNCULO (fecha ISO). Los disparos anteriores a esta
   * fecha no cuentan, porque en ese entonces la consecuencia NO tenía por qué
   * seguirles.
   *
   * Sin esto el panel acusa un vínculo recién cableado durante toda la ventana:
   * el fit check se volvió el escritor de `worn` el 2026-08-11, pero la ventana
   * de 30 días alcanzaba hasta julio, así que 19 fit checks que por diseño
   * nunca escribieron `worn` se contaban como fallos. El panel nació en el
   * mismo commit que ese arreglo (3e3fada) y por eso llevaba en rojo desde que
   * nació, con el vínculo funcionando al 100%.
   *
   * Un rojo permanente es peor que un verde permanente: el verde sólo aburre,
   * el rojo entrena a ignorar justo el estado que debería hacerte actuar.
   */
  desde?: string;
  /**
   * Cuántos disparos hacen falta antes de creerle al veredicto. Con dos o tres
   * usos, un cero puede ser casualidad; con veinte, no.
   */
  minimo?: number;
  /** Qué se rompe si esta señal se seca — lo que hace accionable el aviso. */
  cuesta: string;
};

export type Veredicto = {
  nombre: string;
  estado: "seca" | "floja" | "viva" | "sin-datos";
  /** Qué proporción de disparos produjo su consecuencia (0-100). */
  cobertura: number;
  detalle: string;
  cuesta: string;
};

const MINIMO_POR_DEFECTO = 3;

/**
 * Cuenta eventos de un tipo respetando el `desde` del par.
 *
 * Vive aquí y no en la pantalla a propósito: el "desde cuándo cuenta" es parte
 * de la definición de la señal, no del render. Cuando esto vivía en la página,
 * la página contaba todo lo de la ventana y el par no tenía forma de decir que
 * la mitad de esos disparos eran de otra época.
 */
export function contarEventos(
  eventos: { type: string; created_at: string }[],
  tipo: string,
  desde?: string
): number {
  return eventos.filter((e) => e.type === tipo && (!desde || e.created_at >= desde))
    .length;
}

/** "2026-08-11" → "11 ago", para que el panel diga qué periodo miró. */
function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * El veredicto de un par. Cuatro estados y no dos, porque "0 de 0" y "0 de 24"
 * son cosas distintas y mezclarlas es lo que hace que un panel se ignore:
 *
 *   · sin-datos — no hubo disparos; no hay nada que concluir.
 *   · seca — hubo disparos suficientes y NINGUNA consecuencia. Roto.
 *   · floja — llegan algunas pero se pierden más de la mitad.
 *   · viva — la mayoría de los disparos produjo su consecuencia.
 */
export function evaluarPar(p: ParDeSenales): Veredicto {
  const minimo = p.minimo ?? MINIMO_POR_DEFECTO;
  const cobertura = p.disparos > 0 ? Math.round((100 * p.consecuencias) / p.disparos) : 0;
  // El periodo va EN el detalle, no de nota al pie: un veredicto que no dice
  // sobre qué tramo se calculó es el que hace pensar que mide otra cosa.
  const periodo = p.desde ? ` (desde el ${fechaCorta(p.desde)})` : "";
  const base = { nombre: p.nombre, cobertura, cuesta: p.cuesta };

  if (p.disparos === 0) {
    return {
      ...base,
      estado: "sin-datos",
      detalle: `nadie usó "${p.disparador}" en la ventana${periodo}; no hay nada que concluir`,
    };
  }
  if (p.consecuencias === 0 && p.disparos >= minimo) {
    return {
      ...base,
      estado: "seca",
      detalle: `${p.disparos} × "${p.disparador}" y NINGÚN "${p.consecuencia}"${periodo}`,
    };
  }
  if (p.consecuencias === 0) {
    return {
      ...base,
      estado: "sin-datos",
      detalle: `sólo ${p.disparos} ${p.disparos === 1 ? "uso" : "usos"} de "${p.disparador}"${periodo} — muy poco para concluir (hacen falta ${minimo})`,
    };
  }
  return {
    ...base,
    estado: cobertura < 50 ? "floja" : "viva",
    detalle: `${p.consecuencias} de ${p.disparos} × "${p.disparador}" produjeron "${p.consecuencia}"${periodo}`,
  };
}

/** Los pares evaluados, con lo roto arriba: un panel se lee de arriba abajo. */
export function evaluarSenales(pares: ParDeSenales[]): Veredicto[] {
  const orden: Record<Veredicto["estado"], number> = {
    seca: 0,
    floja: 1,
    "sin-datos": 2,
    viva: 3,
  };
  return pares.map(evaluarPar).sort((a, b) => orden[a.estado] - orden[b.estado]);
}
