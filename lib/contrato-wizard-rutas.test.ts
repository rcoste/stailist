import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// EL CANDADO CONTRA "EL WIZARD PREGUNTA Y LA RUTA NO ESCUCHA".
//
// El wizard manda un `LookInput` completo por la red. Las rutas tipan su `body`
// A MANO, así que un campo que no se nombra ahí simplemente no existe: llega,
// se cae al piso y NADA falla. No hay error de tipos (el JSON entra como
// `unknown`), no hay log, no hay test rojo. Solo un look que ignora lo que la
// persona acababa de contestar.
//
// Ya pasó dos veces, y las dos en el mismo trimestre:
// · `/api/generate` nunca declaró `formality` ni `tipoEvento`. En el onboarding
//   podías decir "una boda" y "formal" y recibir el look de un martes — en el
//   PRIMER look, el que decide si vuelves. (Arreglado 2026-08-12.)
// · El CTA del home reusaba el look cacheado del día ignorando la ocasión
//   recién elegida: pedir "una boda" contestaba con el de la oficina.
//   (Arreglado en 0.2.223.0.)
//
// Este test compara el contrato contra las dos rutas que lo reciben. No prueba
// que el campo se USE bien — prueba que la ruta al menos lo mira, que es donde
// se rompió.

const RAIZ = join(import.meta.dirname, "..");
const leer = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

/** Los campos declarados en `export type LookInput = { … }`.
 *
 *  El bloque NO cierra con `};` sino con `} & ({lat,lon} | {weather})`, así que
 *  el corte va en la primera llave a principio de línea. Cortar mal no truena:
 *  arrastraría los campos del tipo siguiente y el test empezaría a exigir cosas
 *  que el wizard nunca manda. */
function camposDeLookInput(): string[] {
  const fuente = leer("components/weather-picker.tsx");
  const inicio = fuente.indexOf("export type LookInput = {");
  expect(inicio, "LookInput cambió de nombre o de archivo").toBeGreaterThan(-1);
  const resto = fuente.slice(inicio);
  const cierre = resto.search(/\n\}/);
  expect(cierre, "no encontré el cierre de LookInput").toBeGreaterThan(-1);
  const cuerpo = resto.slice(0, cierre);
  return [
    ...new Set([
      ...[...cuerpo.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*)\??:/gm)].map((m) => m[1]),
      // La unión del final: la ubicación o el clima a mano. Van a mano aquí
      // porque viven fuera del bloque, pero son parte del mismo contrato.
      "lat",
      "lon",
      "weather",
    ]),
  ];
}

/**
 * Campos que una ruta puede ignorar CON RAZÓN. Cada exención lleva su porqué:
 * la lista es el lugar donde se discute, no un cajón de sastre.
 */
const EXENTOS: Record<string, Record<string, string>> = {
  "app/api/generate/route.ts": {
    // El wow arma el PRIMER look, siempre para hoy y sin ancla: no hay clóset
    // que anclar todavía ni agenda que planear.
    seedItemId: "el wow no ofrece anclar prendas",
    plannedFor: "el primer look es de hoy; planear otros días vive en /hoy",
    fechaLocal: "sin planear para otro día, la fecha local no cambia nada",
    // No los lee por nombre: le pasa el body ENTERO a resolveWeather(body),
    // que sí los mira. Llegan a su destino por otra puerta.
    lat: "los consume resolveWeather(body)",
    lon: "los consume resolveWeather(body)",
    weather: "los consume resolveWeather(body)",
  },
  "app/api/look-of-day/route.ts": {},
};

const RUTAS = Object.keys(EXENTOS);

describe("el contrato del wizard llega entero a las rutas", () => {
  const campos = camposDeLookInput();

  it("LookInput sigue teniendo los campos que este test cree vigilar", () => {
    // Si el regex deja de casar, el test pasaría en vacío y no vigilaría nada.
    expect(campos.length).toBeGreaterThan(8);
    expect(campos).toContain("formality");
    expect(campos).toContain("tipoEvento");
  });

  for (const ruta of RUTAS) {
    it(`${ruta} lee cada campo que el wizard manda`, () => {
      const fuente = leer(ruta);
      const exentos = EXENTOS[ruta];
      const sordos = campos.filter(
        (c) => !exentos[c] && !new RegExp(`\\bbody\\.${c}\\b`).test(fuente)
      );
      expect(
        sordos,
        `Estos campos viajan desde el wizard y esta ruta NUNCA los mira, así que ` +
          `se pierden en silencio: ${sordos.join(", ")}. O los cableas al ` +
          `contexto, o los declaras exentos en EXENTOS con su razón.`
      ).toEqual([]);
    });
  }

  it("no hay exenciones para campos que ya no existen", () => {
    // Una exención huérfana es peor que ninguna: parece que alguien lo pensó.
    const huerfanas = Object.entries(EXENTOS).flatMap(([ruta, exentos]) =>
      Object.keys(exentos)
        .filter((c) => !campos.includes(c))
        .map((c) => `${ruta}: ${c}`)
    );
    expect(huerfanas, `Exenciones de campos inexistentes: ${huerfanas.join(", ")}`).toEqual(
      []
    );
  });
});
