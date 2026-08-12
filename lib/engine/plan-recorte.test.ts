import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PLAN_MAX_CHARS, recortarPlan } from "@/lib/engine/contexto";

// El plan escrito a mano se guarda en `outfits.plan` (migración 0132) para poder
// leer LA COLA LARGA de lo que la gente le pide al stylist con sus palabras —
// hasta 2026-08-12 ese texto viajaba al modelo y se evaporaba, así que no había
// forma de saber ni cuánta gente usaba el campo ni qué escribía.
//
// La columna solo sirve si guarda EXACTAMENTE lo que el modelo vio: existe para
// calibrar el prompt contra planes reales, y calibrarlo contra un texto más
// largo del que el motor recibió sería calibrarlo contra otra cosa. De ahí que
// las dos mitades salgan de la misma función.

describe("recortarPlan — lo que se guarda es lo que el motor vio", () => {
  it("deja pasar el texto corto tal cual", () => {
    expect(recortarPlan("el bautizo de mi ahijado")).toBe("el bautizo de mi ahijado");
  });

  it("recorta al tope y no más", () => {
    const largo = "a".repeat(PLAN_MAX_CHARS + 50);
    expect(recortarPlan(largo)).toHaveLength(PLAN_MAX_CHARS);
  });

  it("lo que no es texto es null, no una cadena rara", () => {
    // El body llega como JSON sin validar: un número o un objeto no pueden
    // terminar guardados como "[object Object]".
    for (const basura of [null, undefined, 42, {}, [], true]) {
      expect(recortarPlan(basura)).toBeNull();
    }
  });

  it("el vacío se guarda como vacío, no como null", () => {
    // Distinguir "no escribió" (null) de "escribió y borró" (cadena vacía) no
    // cambia nada hoy, pero convertir uno en otro sí escondería datos.
    expect(recortarPlan("")).toBe("");
  });
});

describe("las rutas guardan el plan con esa misma función", () => {
  const RAIZ = join(import.meta.dirname, "..", "..");
  const RUTAS = ["app/api/look-of-day/route.ts", "app/api/generate/route.ts"];

  for (const ruta of RUTAS) {
    it(`${ruta} escribe plan: recortarPlan(...)`, () => {
      // Si alguien lo cambia por `body.plan` a secas, la columna empieza a
      // guardar más de lo que el modelo leyó y la calibración se envenena sin
      // que nada truene.
      const fuente = readFileSync(join(RAIZ, ruta), "utf8");
      expect(
        /plan:\s*recortarPlan\(/.test(fuente),
        `${ruta} debe guardar el plan con recortarPlan(), no a mano: la columna ` +
          `existe para reflejar lo que el motor vio.`
      ).toBe(true);
    });
  }
});
