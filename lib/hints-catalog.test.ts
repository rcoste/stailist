import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { HINT_IDS, HINT_MODO, type HintId } from "./hints-catalog";

// El candado contra la podredumbre silenciosa de los tips.
//
// Historia real: el rediseño del detalle del look (commit 7200585, 2026-07-24)
// borró el `data-hint-target="hoy-tryon"` del botón "verme con este look". El
// tip quedó imposible de dibujar, nada falló, nadie se enteró — y encima se
// quedaba con el turno cada visita, enterrando al tip de viaje. Cuatro días
// después se descubrió a ojo.
//
// Un tip roto no se nota en pantalla (por diseño: los tips no bloquean nada), así
// que la única forma de enterarse es que truene la suite.

const RAIZ = join(import.meta.dirname, "..");
const CARPETAS = ["app", "components"];
const EXT = /\.(tsx|ts)$/;

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const entrada of readdirSync(dir)) {
    // .claude tiene worktrees con copias viejas del repo: no cuentan.
    if (entrada === "node_modules" || entrada.startsWith(".")) continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) out.push(...archivos(ruta));
    else if (EXT.test(entrada)) out.push(ruta);
  }
  return out;
}

const FUENTES = CARPETAS.flatMap((c) => archivos(join(RAIZ, c))).map((ruta) => ({
  ruta,
  texto: readFileSync(ruta, "utf8"),
}));

// El componente Hint es quien BUSCA los targets; sus propias menciones del
// atributo son la implementación, no un target de verdad.
const CODIGO = FUENTES.filter((f) => !f.ruta.endsWith("components/hint.tsx"));

const targetsDeclarados = new Set<string>();
for (const f of CODIGO) {
  for (const m of f.texto.matchAll(/data-hint-target="([^"]+)"/g)) {
    targetsDeclarados.add(m[1]);
  }
}

const spotlights = HINT_IDS.filter((id) => HINT_MODO[id] === "spotlight");

describe("catálogo de hints", () => {
  it("todo hint de tipo spotlight tiene su data-hint-target en el código", () => {
    const huerfanos = spotlights.filter((id) => !targetsDeclarados.has(id));
    expect(
      huerfanos,
      `Estos tips señalan un elemento que ya no existe, así que NO se dibujan ` +
        `nunca: ${huerfanos.join(", ")}. O le devuelves el data-hint-target al ` +
        `elemento correcto del UI nuevo, o borras el hint del catálogo.`
    ).toEqual([]);
  });

  it("todo data-hint-target del código corresponde a un hint declarado", () => {
    const sueltos = [...targetsDeclarados].filter(
      (t) => !HINT_IDS.includes(t as HintId)
    );
    expect(
      sueltos,
      `Marcan un target para un hint que no existe (¿typo?): ${sueltos.join(", ")}`
    ).toEqual([]);
  });

  it("todo hint del catálogo se monta en alguna pantalla", () => {
    // Un id que ya nadie usa es peso muerto: aparece en el catálogo, en el
    // reset de "volver a ver los tips" y en las métricas, sin existir.
    const sinUso = HINT_IDS.filter((id) => {
      const usoReal = new RegExp(`["']${id}["']`);
      return !CODIGO.some((f) =>
        f.texto
          .split("\n")
          .some((l) => !l.includes("data-hint-target") && usoReal.test(l))
      );
    });
    expect(sinUso, `Declarados pero nunca mostrados: ${sinUso.join(", ")}`).toEqual(
      []
    );
  });

  it("los centrados son la excepción, no la regla", () => {
    // Si algún día la mayoría son centrados, el spotlight dejó de servir y hay
    // que replantearlo — no seguir agregando velos planos por inercia.
    expect(spotlights.length).toBeGreaterThan(HINT_IDS.length / 2);
  });
});
