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
 * Los caminos que hablan con un modelo SIN pasar por `lib/proveedores`.
 *
 * Todos instancian el SDK de Anthropic directo (`new Anthropic()`), así que ni
 * siquiera calculan el `Recibo` que la puerta común produce gratis: no hay ms,
 * ni tokens, ni costo que guardar. Migrarlos es trabajo aparte y con riesgo
 * propio (cada uno tiene su forma de pedir JSON), por eso quedan declarados en
 * vez de arreglados a las carreras.
 *
 * EL MÁS CARO DE LA LISTA es `capsule-target`: armar los esenciales es una
 * llamada larga de Opus (~40s típico, hasta 300s de tope) y es justo la que
 * más se querría medir.
 */
export const CAMINOS_SIN_MEDIR: CaminoSinMedir[] = [
  {
    archivo: "lib/engine/capsule-target.ts",
    etiqueta: "armar esenciales",
    razon: "SDK directo; es la llamada más larga del producto (~40s de Opus)",
  },
  {
    archivo: "lib/engine/capsule-match.ts",
    etiqueta: "cruzar esenciales con tu clóset",
    razon: "SDK directo",
  },
  {
    archivo: "lib/engine/capsule-swap.ts",
    etiqueta: "cambiar una pieza de esenciales",
    razon: "SDK directo",
  },
  {
    archivo: "lib/engine/trip-capsule.ts",
    etiqueta: "armar maleta",
    razon: "SDK directo",
  },
  {
    archivo: "lib/engine/style-questions.ts",
    etiqueta: "preguntas de estilo",
    razon: "SDK directo",
  },
  {
    archivo: "lib/engine/archetype.ts",
    etiqueta: "arquetipo de estilo",
    razon: "SDK directo",
  },
  {
    archivo: "lib/engine/anchor-fit.ts",
    etiqueta: "encaje de la prenda ancla",
    razon: "SDK directo",
  },
  {
    archivo: "app/api/analizar-cuerpo/route.ts",
    etiqueta: "leer silueta",
    razon: "SDK directo en la ruta",
  },
  {
    archivo: "app/api/estilo-referencia/route.ts",
    etiqueta: "estilo de referencia",
    razon: "SDK directo en la ruta",
  },
  // ESTOS CUATRO APARECIERON AL BARRER EL DISCO (candado de recibos,
  // 2026-08-14): la lista se había escrito a mano con nueve y el modo Viaje
  // entero se había quedado fuera. Cuentan igual —son llamadas de IA sin
  // recibo— y omitirlos hacía justo lo que este archivo existe para evitar: que
  // la pantalla enseñe menos huecos de los que hay.
  {
    archivo: "lib/engine/trip-outfits.ts",
    etiqueta: "outfits del viaje",
    razon: "SDK directo; son dos llamadas (armar y revisar) por viaje",
  },
  {
    archivo: "lib/engine/trip-substitutes.ts",
    etiqueta: "sustitutos de la maleta",
    razon: "SDK directo",
  },
  {
    archivo: "app/api/trip/itinerario/route.ts",
    etiqueta: "leer el itinerario",
    razon: "SDK directo en la ruta",
  },
  {
    archivo: "app/api/avatar/generate/route.ts",
    etiqueta: "juez del avatar",
    razon: "SDK directo en la ruta (la imagen la genera Gemini; esto la juzga)",
  },
  // AQUÍ ESTABA EL HUECO MÁS CARO Y SE CERRÓ (2026-09-02). Todo lo que genera
  // imágenes —try-on, avatar, arquetipos, renders de prenda, fotos de destino—
  // pasa por `lib/gemini-imagen.ts` y ninguno dejaba recibo, porque una imagen
  // no se cobra por token y la tabla de precios sólo sabía de tokens. Ahora hay
  // tarifa por imagen (`PRECIOS_IMAGEN`, verificada contra la documentación de
  // Google) y su propio escritor (`guardarReciboImagen`).
  //
  // Lo que se veía sin esto: entre el 13 de agosto y el 2 de septiembre se
  // generaron 157 imágenes, ~$21, contra $2.58 de recibos de texto. El panel
  // enseñaba el 11% del gasto — y sobre ese 11% se había concluido que la app
  // costaba ~$18 al mes.
];

/** Sólo las etiquetas, que es lo que la pantalla enseña. */
export const TAREAS_SIN_MEDIR: string[] = CAMINOS_SIN_MEDIR.map((c) => c.etiqueta);

/** Los archivos, que es contra lo que compara el candado. */
export const ARCHIVOS_SIN_MEDIR: string[] = CAMINOS_SIN_MEDIR.map((c) => c.archivo);
