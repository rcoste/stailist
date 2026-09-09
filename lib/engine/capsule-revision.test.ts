import { describe, expect, it } from "vitest";
import { revisarCapsula, type ContextoRevision } from "./capsule-revision";
import type { CapsuleItem } from "@/lib/capsule";

// Los casos son las CÁPSULAS REALES de producción (15, al 2026-09-09). El juez
// se escribió corriéndolo contra ellas: una regla que no caza nada no gana su
// sitio, y una que caza todo tampoco. Cazó 2 huecos que nadie había visto — y
// una alarma FALSA que este archivo fija para que no vuelva.
const p = (x: Partial<CapsuleItem>): CapsuleItem => ({
  nombre: "x", tipo: "x", category: "top", colorFamilia: "negro",
  formalidad: "casual", temporada: "todo-el-año", prioridad: 1, porque: "x", ...x,
});
const base = [p({ category: "bottom", nombre: "Jeans" }), p({ category: "calzado", nombre: "Tenis" })];
const ctx = (x: Partial<ContextoRevision> = {}): ContextoRevision => ({ gender: "hombre", ...x });
const reglas = (items: CapsuleItem[], c = ctx()) => revisarCapsula(items, c).map((h) => h.regla);

describe("revisarCapsula — el juez que la cápsula no tenía", () => {
  it("una cápsula sana no dispara nada", () => {
    expect(reglas([...base, p({ category: "saco", nombre: "Blazer marino" })])).toEqual([]);
  });

  it("el caso de Tatiana: techo formal, blazer formal y CERO bottoms formales", () => {
    const h = revisarCapsula(
      [
        ...base,
        p({ category: "saco", nombre: "Blazer estructurado gris perla", formalidad: "formal" }),
        p({ category: "bottom", nombre: "Falda midi satinada", formalidad: "formal-casual" }),
        p({ category: "vestido", nombre: "Vestido de gala satén", formalidad: "formal" }),
        p({ category: "calzado", nombre: "Zapatilla de tacón", formalidad: "formal" }),
      ],
      ctx({ gender: "mujer", techo: "formal" })
    );
    expect(h.map((x) => x.regla)).toEqual(["sin-camino-formal"]);
    expect(h[0].detalle).toContain("Blazer estructurado gris perla");
  });

  it("el caso de mleomarti: sastrería formal sin un solo zapato formal", () => {
    expect(
      reglas(
        [
          ...base,
          p({ category: "saco", nombre: "Blazer estructurado negro", formalidad: "formal" }),
          p({ category: "bottom", nombre: "Pantalón de sastre negro", formalidad: "formal" }),
        ],
        ctx({ gender: "mujer" })
      )
    ).toEqual(["sin-calzado-formal"]);
  });

  // LA ALARMA FALSA, fijada. El juez decía que el "Smoking negro de solapa de
  // satín" de Roberto no tenía pantalón — y la cápsula trae "Pantalón de
  // smoking negro". El patrón buscaba traje|vestir|sastre y ese nombre no dice
  // ninguna de las tres. A la tercera alarma falsa nadie le cree al juez.
  it("el smoking va con SU pantalón: no es un hueco (era un falso positivo)", () => {
    expect(
      reglas([
        ...base,
        p({ category: "saco", nombre: "Smoking negro de solapa de satín", tipo: "smoking", hueco: "traje de gala" }),
        p({ category: "bottom", nombre: "Pantalón de smoking negro", tipo: "pantalon-smoking", hueco: "pantalón de gala" }),
      ])
    ).toEqual([]);
  });

  it("y un smoking SIN su pantalón sí es un hueco (el pantalón de vestir no cuenta)", () => {
    const h = reglas([
      ...base,
      p({ category: "saco", nombre: "Smoking negro", tipo: "smoking", hueco: "traje de gala" }),
      p({ category: "bottom", nombre: "Pantalón de vestir negro", tipo: "pantalon-vestir" }),
    ]);
    expect(h).toContain("traje-sin-pantalon");
  });

  it("saco de traje sin su pantalón del mismo color", () => {
    const h = revisarCapsula(
      [...base, p({ category: "saco", nombre: "Saco de traje marino", tipo: "saco-de-traje", colorFamilia: "marino" })],
      ctx()
    );
    expect(h.map((x) => x.regla)).toContain("traje-sin-pantalon");
    expect(h[0].detalle).toContain("marino");
  });

  it("un BLAZER no necesita pantalón a juego: es la pieza que va con jeans", () => {
    expect(reglas([...base, p({ category: "saco", nombre: "Blazer de lana marino", tipo: "blazer", colorFamilia: "marino" })])).toEqual([]);
  });

  it("hombre con techo formal y sin sastrería: no tiene con qué vestir la ocasión", () => {
    expect(reglas(base, ctx({ techo: "formal" }))).toContain("sin-camino-formal");
  });

  it("'smart' NO exige traje: es business casual, y pedirlo sería inventarle la vida", () => {
    expect(reglas(base, ctx({ techo: "smart" }))).toEqual([]);
  });

  it("en mujer un vestido cubre el hueco de abajo: no es carencia", () => {
    expect(
      reglas([p({ category: "vestido", nombre: "Vestido midi" }), p({ category: "calzado", nombre: "Tenis" })], ctx({ gender: "mujer" }))
    ).toEqual([]);
  });

  it("sin calzado no hay un solo look completo", () => {
    expect(reglas([p({ category: "bottom", nombre: "Jeans" })])).toContain("categoria-vacia");
  });

  it("clima frío sin una sola capa de abrigo", () => {
    expect(reglas(base, ctx({ clima: "frio" }))).toContain("sin-abrigo-en-frio");
  });
});
