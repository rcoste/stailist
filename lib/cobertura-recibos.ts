// QUÉ CAMINOS DE IA NO DEJAN RECIBO TODAVÍA.
//
// Este archivo es dato, no adorno: lo lee el panel `/admin/ia` para declarar
// sus propios huecos, y lo lee el candado `lib/cobertura-recibos.test.ts` para
// que nadie agregue una tarea ciega sin darse cuenta.
//
// POR QUÉ VIVE APARTE DEL TEST: si la lista viviera sólo en el test, la
// pantalla no podría advertir que está enseñando una vista parcial — y una
// pantalla de observabilidad que calla sus huecos se lee como "todo bien"
// cuando en realidad dice "no estoy mirando". Ese malentendido es justo el que
// costó dos semanas de precalentado roto en producción (2026-08-13).
//
// CÓMO SE VACÍA ESTA LISTA: migrando cada archivo a la puerta común
// (`lib/proveedores`) y llamando con `medir()` de `lib/recibos.ts`. Cada vez
// que uno se migre, se borra su renglón de aquí y el panel deja de advertirlo.

export type CaminoSinMedir = {
  /** Ruta del archivo, tal cual desde la raíz del repo. */
  archivo: string;
  /** Cómo se le dice a esto en la app, para que la pantalla sea legible. */
  etiqueta: string;
  /** Por qué no mide todavía. */
  razon: string;
};

/**
 * Los caminos que hablan con un modelo y NO dejan recibo.
 *
 * Hasta el 2026-10-05 eran trece, todos con el SDK de Anthropic directo
 * (`new Anthropic()`); el más caro, `capsule-target` (Opus, ~40s). Se cerraron
 * envolviendo cada llamada con `medirAnthropic()` en vez de migrarlos a la
 * puerta común, que habría cambiado cómo le hablan al modelo.
 */
export const CAMINOS_SIN_MEDIR: CaminoSinMedir[] = [
  // VACÍA desde el 2026-10-05. Los trece caminos que llamaban al SDK de
  // Anthropic directo (esenciales, viaje, arquetipo, preguntas de estilo,
  // silueta, estilo de referencia, juez del avatar…) ahora envuelven la llamada
  // con `medirAnthropic()` (lib/recibos.ts) y dejan recibo. Si un camino nuevo
  // nace sin medir, el candado (lib/cobertura-recibos.test.ts) lo caza y se
  // declara aquí con su razón mientras se arregla.
];

/** Sólo las etiquetas, que es lo que la pantalla enseña. */
export const TAREAS_SIN_MEDIR: string[] = CAMINOS_SIN_MEDIR.map((c) => c.etiqueta);

/** Los archivos, que es contra lo que compara el candado. */
export const ARCHIVOS_SIN_MEDIR: string[] = CAMINOS_SIN_MEDIR.map((c) => c.archivo);
