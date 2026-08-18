import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { POOL_BRIEFS_PARA_TEST, POOL_VERSION } from "./motor";

// EL CANDADO CONTRA "EL LABORATORIO MIDE LA MITAD DEL PRODUCTO".
//
// Lo que pasó, y por eso existe este archivo: la pantalla de "¿qué plan
// tienes?" ofrece seis planes sociales de un toque, y el pool del comparador
// sólo medía tres —boda, cena con amigos y comida familiar—. Una cita, una
// fiesta y una comida de trabajo NUNCA se habían medido, aunque el motor lleva
// días sabiéndolas resolver. Y al revés: el pool sí medía `funeral`, que ni
// siquiera está en esa pantalla.
//
// Nadie lo cazó porque no había nada que lo cazara: agregar un plan a la app y
// no agregarlo al pool no rompe ningún test, no truena el build y no se ve en
// ninguna pantalla. Sólo hace que las corridas midan un motor que ya no es el
// que corre.
//
// Este test compara las dos listas. Si mañana entra un séptimo plan a la app y
// nadie lo mete al pool, esto se pone rojo con el nombre del plan que falta.

const RAIZ = join(import.meta.dirname, "..", "..");

/** Los planes que la app ofrece de un toque, leídos de la fuente. */
function planesVisiblesDeLaApp(): string[] {
  const fuente = readFileSync(join(RAIZ, "components/weather-picker.tsx"), "utf8");
  const i = fuente.indexOf("const PLANES_VISIBLES");
  expect(i, "PLANES_VISIBLES cambió de nombre o de archivo").toBeGreaterThan(-1);
  const bloque = fuente.slice(i, fuente.indexOf("];", i));
  return [...bloque.matchAll(/key:\s*"([^"]+)"/g)].map((m) => m[1]);
}

describe("el pool mide lo que la app ofrece", () => {
  const visibles = planesVisiblesDeLaApp();
  const enPool = new Set(
    POOL_BRIEFS_PARA_TEST.map((b) => b.tipoEvento).filter((x): x is string => !!x)
  );

  it("sigue encontrando los planes que este test cree vigilar", () => {
    // Si el regex deja de casar, el test pasaría en vacío sin vigilar nada.
    expect(visibles.length).toBeGreaterThanOrEqual(6);
    expect(visibles).toContain("boda");
  });

  for (const plan of planesVisiblesDeLaApp()) {
    it(`"${plan}" se mide en el pool`, () => {
      expect(
        enPool.has(plan),
        `La app ofrece "${plan}" de un toque y ningún brief del pool lo mide. ` +
          `Agrega un brief con tipoEvento "${plan}" y sube POOL_VERSION (hoy ${POOL_VERSION}), ` +
          `o el laboratorio seguirá midiendo un motor que no es el que corre.`
      ).toBe(true);
    });
  }

  it("todo brief con plan declara también su tipo de evento", () => {
    // Un brief con `plan` de texto libre y sin `tipoEvento` mide al parser, no
    // al motor: producción SÍ manda el tipo cuando el wizard lo preguntó.
    const cojos = POOL_BRIEFS_PARA_TEST.filter((b) => b.plan && !b.tipoEvento).map(
      (b) => b.etiqueta
    );
    expect(cojos, `Briefs con plan y sin tipoEvento: ${cojos.join(", ")}`).toEqual([]);
  });
});
