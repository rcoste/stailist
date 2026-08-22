import { describe, it, expect } from "vitest";
import { conNombres } from "./generar-lado";

// Lo que este test blinda no es el formato: es que el look guardado siga
// siendo legible cuando sus prendas ya no existan. El 2026-08-18 se recreó el
// clóset de Roberto y 393 votos quedaron apuntando a ids muertos.
describe("conNombres — el look congela el nombre de sus prendas", () => {
  const items = [
    { id: "a", attrs: { nombre: "Camisa blanca" } },
    { id: "b", attrs: { nombre: "Chinos beige" } },
    { id: "c", attrs: { nombre: null } },
  ];

  it("guarda un nombre por id, en el mismo orden que item_ids", () => {
    const [l] = conNombres([{ item_ids: ["b", "a"], nombre: "x" }], items);
    expect(l.prendas).toEqual([
      { id: "b", nombre: "Chinos beige" },
      { id: "a", nombre: "Camisa blanca" },
    ]);
    expect(l.item_ids).toEqual(["b", "a"]); // lo demás del look no se toca
    expect(l.nombre).toBe("x");
  });

  it("una prenda sin nombre o que no está en el clóset queda como 'Prenda', nunca revienta", () => {
    const [l] = conNombres([{ item_ids: ["c", "zzz"] }], items);
    expect(l.prendas.map((p) => p.nombre)).toEqual(["Prenda", "Prenda"]);
  });
});

import { elegirPromptAnterior } from "./generar-lado";

// El freno: lo nuevo tiene que ganarle a lo de ayer. Lo que se blinda es QUÉ
// versión corre como "anterior" y cuándo se rehúsa a correr.
describe("elegirPromptAnterior — qué versión corre como 'la de ayer'", () => {
  const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
  const texto = (ids: number[]) => ids.map((i) => `${uuid(i)}: prenda ${i}`).join("\n");
  const c = (version: string, ids: number[], poolVersion = "v8") => ({
    version,
    poolVersion,
    system: `system de ${version}`,
    briefs: [{ etiqueta: "cita · noche templada", texto: texto(ids) }],
  });
  const vivos = new Set([uuid(1), uuid(2), uuid(3)]);

  it("toma el congelado más reciente que NO sea la versión vigente", () => {
    const r = elegirPromptAnterior(
      [c("v57", [1, 2]), c("v53", [1, 2]), c("v48", [1])],
      "cita · noche templada",
      vivos,
      "v57",
      "v8"
    );
    expect("congelado" in r && r.congelado.version).toBe("v53");
    expect("congelado" in r && r.congelado.system).toBe("system de v53");
  });

  it("sin ninguna versión anterior congelada, falla y dice qué script correr", () => {
    const r = elegirPromptAnterior([c("v57", [1])], "cita · noche templada", vivos, "v57", "v8");
    expect("error" in r && r.error).toMatch(/prompt-congelar/);
  });

  it("un congelado de OTRO pool no sirve: sus briefs no son los de hoy", () => {
    const r = elegirPromptAnterior([c("v53", [1], "v7")], "cita · noche templada", vivos, "v57", "v8");
    expect("error" in r).toBe(true);
  });

  it("si el clóset cambió (una prenda del mensaje ya no existe), se rehúsa a correr", () => {
    const r = elegirPromptAnterior([c("v53", [1, 9])], "cita · noche templada", vivos, "v57", "v8");
    expect("error" in r && r.error).toMatch(/prendas_desaparecidas/);
  });

  it("un brief que el congelado no tiene, falla con su nombre", () => {
    const r = elegirPromptAnterior([c("v53", [1])], "boda · noche templada", vivos, "v57", "v8");
    expect("error" in r && r.error).toMatch(/boda/);
  });
});
