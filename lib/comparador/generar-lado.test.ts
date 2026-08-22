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
