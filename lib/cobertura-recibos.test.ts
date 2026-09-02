import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { CAMINOS_SIN_MEDIR } from "./cobertura-recibos";

// EL CANDADO CONTRA "LA TAREA NUEVA NACE CIEGA".
//
// La tabla `ai_calls` (migración 0133) existía desde hacía días y sólo DOS de
// ~20 caminos de IA escribían en ella; el fallo se registraba en UNO. O sea que
// la tabla costaba una migración y no podía contestar ninguna de las tres
// preguntas para las que se hizo: cuánto tarda cada tarea, cuánto cuesta, cada
// cuánto truena. No fue negligencia de nadie en particular — era el diseño:
// registrar el recibo eran dos líneas aparte de la llamada, y lo que se puede
// olvidar se olvida.
//
// `medir()` (lib/recibos.ts) arregla la mitad: llamar y registrar en el mismo
// sitio. Este test es la otra mitad. Enumera del disco los archivos de `lib/` y
// `app/` que HABLAN CON UN MODELO y exige que cada uno mida o esté declarado
// exento con su razón escrita. Sin esto, el siguiente camino de IA vuelve a
// nacer sin recibo y nos enteramos dentro de tres meses, discutiendo de oído
// otra decisión de producto.
//
// LO QUE ESTE TEST **NO** PUEDE VER: que la RUTA le pase el contexto a la
// función de `lib/`. El parámetro es opcional (tiene que serlo: el comparador,
// los evales y los scripts llaman lo mismo sin sesión), así que una ruta que se
// olvide compila y corre. Lo que sí queda blindado es el eslabón donde se
// perdía todo: que la llamada al modelo pase por `medir`.

const RAIZ = join(import.meta.dirname, "..");

/** Todos los .ts/.tsx bajo una carpeta, saltando tests y node_modules. */
function fuentes(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    if (nombre === "node_modules" || nombre.startsWith(".")) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      salida.push(...fuentes(ruta));
      continue;
    }
    if (!/\.tsx?$/.test(nombre) || /\.test\.tsx?$/.test(nombre)) continue;
    salida.push(ruta);
  }
  return salida;
}

/**
 * El archivo SIN sus líneas de comentario.
 *
 * Hace falta porque en este repo los comentarios HABLAN del código: el propio
 * `lib/cobertura-recibos.ts` explica que los caminos sin medir "instancian
 * `new Anthropic()`", y sin esto el barrido lo contaba como si llamara al
 * modelo. Se filtra por línea (las que empiezan con `//`, `*` o `/*`) y no con
 * un parser: una llamada real nunca vive dentro de una línea que arranca como
 * comentario, y un `// …` al final de una línea de código no la esconde.
 */
function sinComentarios(fuente: string): string {
  return fuente
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join("\n");
}

/**
 * ¿Este archivo habla con un modelo? Tres formas, y las tres cuentan:
 *
 *   · por la PUERTA COMÚN: importa `@/lib/proveedores` y llama a `llamar(`.
 *   · por el SDK DIRECTO: `new Anthropic(`. Son los que nunca se migraron a la
 *     puerta común (ver EXENTOS); si mañana nace otro, este test lo caza igual
 *     en vez de dejarlo pasar por no usar la puerta.
 *   · por HTTP CRUDO al endpoint de Gemini. Esta tercera se agregó el mismo día
 *     que nació el candado y no es un detalle: las dos primeras sólo ven los
 *     modelos de TEXTO, y la generación de IMÁGENES —try-on, avatares,
 *     arquetipos, renders de prendas— entra por aquí. Es, con mucha
 *     probabilidad, el mayor gasto de IA del proyecto, y era el único que podía
 *     crecer sin que nada lo delatara.
 */
function hablaConUnModelo(fuente: string): boolean {
  const codigo = sinComentarios(fuente);
  const porLaPuerta = /from ["']@\/lib\/proveedores["']/.test(codigo) && /\bllamar\(/.test(codigo);
  return (
    porLaPuerta ||
    /new Anthropic\(/.test(codigo) ||
    /generativelanguage\.googleapis\.com/.test(codigo)
  );
}

/**
 * Archivos que hablan con un modelo y NO miden, con su razón. La lista es el
 * lugar donde se discute cada caso, no un cajón de sastre: una entrada sin
 * razón (string vacío) hace fallar el test igual que un archivo sin instrumentar.
 */
const EXENTOS: Record<string, string> = {
  // Las dos piezas de la instrumentación misma.
  "lib/proveedores/index.ts":
    "ES la puerta común: aquí vive `llamar`. Medir aquí adentro fue lo primero que se pensó y no se puede — la usan scripts y el comparador, que no tienen sesión ni cliente de Supabase (ver la cabecera de lib/recibos.ts).",
  "lib/recibos.ts": "ES la implementación de `medir`: la llamada a `llamar` de aquí es la que todos los demás usan.",

  // LOS NUEVE (más cuatro) QUE LLAMAN AL SDK DE ANTHROPIC DIRECTO.
  //
  // No pasan por `lib/proveedores`, así que no tienen recibo que guardar: el
  // tipo `Recibo` (ms, tokens, costo) lo produce la puerta común. Migrarlos es
  // trabajo aparte —cada uno tiene su propio manejo de streaming, reintentos y
  // parseo— y se deja anotado aquí a propósito: mientras estén en esta lista,
  // el proyecto sabe exactamente cuánto de su gasto de IA NO está medido.
  "app/api/analizar-cuerpo/route.ts": "usa el SDK directo, no la puerta común — pendiente de migrar (ver TODOS.md)",
  "app/api/estilo-referencia/route.ts": "usa el SDK directo, no la puerta común — pendiente de migrar (ver TODOS.md)",
  "lib/engine/anchor-fit.ts": "usa el SDK directo, no la puerta común — pendiente de migrar (ver TODOS.md)",
  "lib/engine/archetype.ts": "usa el SDK directo, no la puerta común — pendiente de migrar (ver TODOS.md)",
  "lib/engine/capsule-match.ts": "usa el SDK directo, no la puerta común — pendiente de migrar (ver TODOS.md)",
  "lib/engine/capsule-swap.ts": "usa el SDK directo, no la puerta común — pendiente de migrar (ver TODOS.md)",
  "lib/engine/capsule-target.ts": "usa el SDK directo, no la puerta común — pendiente de migrar (ver TODOS.md)",
  "lib/engine/style-questions.ts": "usa el SDK directo, no la puerta común — pendiente de migrar (ver TODOS.md)",
  "lib/engine/trip-capsule.ts": "usa el SDK directo, no la puerta común — pendiente de migrar (ver TODOS.md)",
  // Estos cuatro salieron al barrer el disco y no estaban en la cuenta de nueve
  // con la que arrancó esta lista. Mismo caso y mismo pendiente: el modo Viaje
  // entero (itinerario, outfits, sustitutos) y la segunda pasada del avatar.
  "app/api/avatar/generate/route.ts": "usa el SDK directo, no la puerta común — pendiente de migrar (ver TODOS.md)",
  "app/api/trip/itinerario/route.ts": "usa el SDK directo, no la puerta común — pendiente de migrar (ver TODOS.md)",
  "lib/engine/trip-outfits.ts": "usa el SDK directo, no la puerta común — pendiente de migrar (ver TODOS.md)",
  "lib/engine/trip-substitutes.ts": "usa el SDK directo, no la puerta común — pendiente de migrar (ver TODOS.md)",

  // LA PUERTA DE LAS IMÁGENES YA NO ESTÁ AQUÍ (2026-09-02). Era el hueco más
  // caro de la lista —try-on, avatar, arquetipos, renders de prenda y fotos de
  // destino, siete consumidores— y se cerró poniendo la tarifa por imagen que
  // le faltaba (`PRECIOS_IMAGEN`) y su propio escritor de recibo
  // (`guardarReciboImagen`). Medido antes de cerrarlo: 157 imágenes en veinte
  // días que ningún recibo veía, ~$21 contra los $2.58 que sí se registraban.
};

/** Los archivos que hablan con un modelo, en rutas relativas con "/". */
function habladores(): string[] {
  return [...fuentes(join(RAIZ, "lib")), ...fuentes(join(RAIZ, "app"))]
    .filter((ruta) => hablaConUnModelo(readFileSync(ruta, "utf8")))
    .map((ruta) => relative(RAIZ, ruta).split(sep).join("/"))
    .sort();
}

describe("cada camino de IA deja recibo", () => {
  const archivos = habladores();

  it("el barrido sigue encontrando los archivos que este test cree vigilar", () => {
    // Si el detector deja de casar (alguien renombra la puerta común, o el
    // import cambia de forma), el test pasaría en vacío y no vigilaría nada —
    // que es exactamente la clase de fallo que existe para impedir.
    expect(archivos.length).toBeGreaterThan(10);
    expect(archivos).toContain("lib/proveedores/index.ts");
    expect(archivos).toContain("lib/engine/trip-outfits.ts");
  });

  it("ninguno llama al modelo sin medir", () => {
    const ciegos = archivos.filter(
      (rel) =>
        !EXENTOS[rel] &&
        // `medir()` es la puerta de texto; `guardarReciboImagen()` la de
        // imagen. Las dos escriben en ai_calls, que es lo que este candado
        // vigila — exigir sólo la primera dejaría fuera todo lo que dibuja.
        !/\b(medir|guardarReciboImagen)\(/.test(
          sinComentarios(readFileSync(join(RAIZ, rel), "utf8"))
        )
    );
    expect(
      ciegos,
      `Estos archivos hablan con un modelo y NO dejan recibo en ai_calls: ` +
        `${ciegos.join(", ")}.\n` +
        `Arréglalo de una de estas dos formas:\n` +
        `  · cambia \`llamar(\` por \`medir(quien && { ...quien, tarea: "<nombre>" }, {…})\` ` +
        `y encadena \`quien: QuienMide | null\` desde la ruta que tiene la sesión ` +
        `(los nombres de tarea van en minúsculas y sin acentos: motor, juez, ` +
        `vision-prenda, espejo…);\n` +
        `  · o decláralo en EXENTOS, en este mismo archivo, CON SU RAZÓN escrita.\n` +
        `Lo que no vale es dejarlo así: sin recibo, esa tarea no aparece en ` +
        `ningún reporte de costo, latencia ni fallos, y nadie se entera hasta ` +
        `que hay que decidir algo con ese número.`
    ).toEqual([]);
  });

  it("toda exención tiene una razón escrita", () => {
    const mudas = Object.entries(EXENTOS)
      .filter(([, razon]) => !razon.trim())
      .map(([rel]) => rel);
    expect(mudas, `Exenciones sin razón: ${mudas.join(", ")}`).toEqual([]);
  });

  it("no hay exenciones para archivos que ya no hablan con un modelo", () => {
    // Una exención huérfana es peor que ninguna: parece que alguien lo pensó.
    // Y si un archivo se migró a `medir`, su exención tiene que irse con él, o
    // el día que alguien lo rompa nadie se enterará.
    const huerfanas = Object.keys(EXENTOS).filter((rel) => !archivos.includes(rel));
    expect(
      huerfanas,
      `Estos archivos están exentos pero ya no hablan con un modelo (o cambiaron ` +
        `de nombre): ${huerfanas.join(", ")}. Bórralos de EXENTOS.`
    ).toEqual([]);
  });

  it("la lista que enseña /admin/ia dice los mismos huecos que este candado", () => {
    // DOS LISTAS DE LO MISMO, Y TIENEN QUE COINCIDIR. `lib/cobertura-recibos.ts`
    // existe para que el panel de observabilidad declare lo que NO está
    // mirando; esta de aquí para que nadie agregue un camino ciego. Si divergen,
    // gana el peor de los dos mundos: el panel se ve completo y no lo está.
    //
    // Ya divergieron nada más nacer: la lista del panel se escribió a mano con
    // nueve archivos y el barrido del disco encontró trece — el modo Viaje
    // entero se había quedado fuera.
    const delPanel = CAMINOS_SIN_MEDIR.map((c) => c.archivo).sort();
    const delCandado = Object.keys(EXENTOS)
      .filter((rel) => /pendiente de migrar/.test(EXENTOS[rel]))
      .sort();
    expect(
      delPanel,
      `El panel /admin/ia y este candado no declaran los mismos caminos sin ` +
        `medir. Cuando migres uno a \`medir()\`, bórralo de LOS DOS: de ` +
        `CAMINOS_SIN_MEDIR (lib/cobertura-recibos.ts) y de EXENTOS (aquí).`
    ).toEqual(delCandado);
  });

  it("las tareas de producción están instrumentadas por su nombre", () => {
    // El candado de arriba sólo exige que se llame a `medir`. Esto fija los
    // NOMBRES: son la llave por la que se agrupa la tabla, y un "vision_prenda"
    // o un "Espejo" partirían el reporte en dos filas que nadie va a notar.
    const esperadas: Record<string, string> = {
      motor: "lib/engine/generate.ts",
      juez: "lib/engine/critic.ts",
      espejo: "lib/espejo.ts",
      "vision-prenda": "lib/vision-prenda.ts",
      "vision-prendas": "lib/vision-prendas.ts",
      "vision-personas": "lib/vision-personas.ts",
      "destino-motivo": "lib/destino-gen.ts",
      rubrica: "lib/engine/rubrica.ts",
      "rubrica-vision": "lib/engine/rubrica-vision.ts",
    };
    const faltantes = Object.entries(esperadas).filter(
      ([tarea, rel]) =>
        !new RegExp(`tarea: "${tarea}"`).test(
          sinComentarios(readFileSync(join(RAIZ, rel), "utf8"))
        )
    );
    expect(
      faltantes.map(([tarea, rel]) => `${tarea} (${rel})`),
      `Estas tareas cambiaron de nombre o de archivo. Si fue a propósito, ` +
        `actualiza este test Y avisa: los reportes que ya existen consultan por ` +
        `el nombre viejo y se quedarían vacíos sin decirlo.`
    ).toEqual([]);
  });
});
