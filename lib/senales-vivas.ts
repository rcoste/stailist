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
  const base = { nombre: p.nombre, cobertura, cuesta: p.cuesta };

  if (p.disparos === 0) {
    return {
      ...base,
      estado: "sin-datos",
      detalle: `nadie usó "${p.disparador}" en la ventana; no hay nada que concluir`,
    };
  }
  if (p.consecuencias === 0 && p.disparos >= minimo) {
    return {
      ...base,
      estado: "seca",
      detalle: `${p.disparos} × "${p.disparador}" y NINGÚN "${p.consecuencia}"`,
    };
  }
  if (p.consecuencias === 0) {
    return {
      ...base,
      estado: "sin-datos",
      detalle: `sólo ${p.disparos} ${p.disparos === 1 ? "uso" : "usos"} de "${p.disparador}" — muy poco para concluir (hacen falta ${minimo})`,
    };
  }
  return {
    ...base,
    estado: cobertura < 50 ? "floja" : "viva",
    detalle: `${p.consecuencias} de ${p.disparos} × "${p.disparador}" produjeron "${p.consecuencia}"`,
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
