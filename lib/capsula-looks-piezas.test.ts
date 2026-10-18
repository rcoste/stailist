import { describe, it, expect } from "vitest";
import { piezasDeCapsulaParaLooks, propiasEn } from "./capsula-looks-piezas";
import { faltaKey } from "./capsule-images";
import type { CapsuleRow } from "./capsule";

// LO QUE BLINDA (2026-10-18, pedido de Roberto): los looks de esenciales usan lo
// que tienes Y lo que guardaste en tu wishlist, marcado como falta; nunca una
// pieza que sigue en comparación, ni una falta que no pediste.

const fila = (nombre: string, tipo: string, effective: CapsuleRow["effective"], by: string | null = null, extra: Partial<CapsuleRow> = {}): CapsuleRow =>
  ({
    item: { nombre, tipo, colorFamilia: "negro", category: "top", formalidad: "casual" },
    index: 0,
    base: effective,
    effective,
    decision: null,
    covered: effective === "tienes",
    by,
    difiere: null,
    swapCount: 0,
    atSwapCap: false,
    dismissed: false,
    ...extra,
  }) as unknown as CapsuleRow;

describe("piezasDeCapsulaParaLooks", () => {
  const tengo = fila("Cuello alto negro", "cuello-alto", "tienes", "Cuello tortuga de cashmere");
  const tengo2 = fila("Blazer negro", "blazer", "tienes", "Blazer estructurado negro");
  const deseada = fila("Vestido de punto negro", "vestido-punto", "falta");
  const noPedida = fila("Top deportivo negro", "top-deportivo", "falta");
  const enDuelo = fila("Abrigo chocolate", "abrigo-largo", "parecido", "Abrigo largo negro");
  const wish = new Set([faltaKey(deseada.item), faltaKey(enDuelo.item)]);

  it("lo que tienes entra con el nombre de TU prenda; lo deseado, con el de la sugerida y marcado", () => {
    const p = piezasDeCapsulaParaLooks([tengo, tengo2, deseada, noPedida, enDuelo], wish);
    expect(p.map((x) => [x.nombre, !!x.falta])).toEqual([
      ["Cuello tortuga de cashmere", false],
      ["Blazer estructurado negro", false],
      ["Vestido de punto negro", true],
    ]);
  });

  it("una pieza en comparación no entra, aunque esté en la wishlist", () => {
    const p = piezasDeCapsulaParaLooks([enDuelo], wish);
    expect(p).toEqual([]);
  });

  it("una falta que no está en la wishlist no entra", () => {
    expect(piezasDeCapsulaParaLooks([noPedida], wish)).toEqual([]);
  });

  it("una pieza retirada de la cápsula no entra aunque esté en la wishlist", () => {
    expect(piezasDeCapsulaParaLooks([fila("Vestido de punto negro", "vestido-punto", "falta", null, { dismissed: true })], wish)).toEqual([]);
  });

  it("la misma prenda tuya cubriendo dos piezas entra una vez, y los índices van seguidos", () => {
    const p = piezasDeCapsulaParaLooks([tengo, fila("Playera negra", "playera", "tienes", "Cuello tortuga de cashmere"), deseada], wish);
    expect(p.map((x) => x.n)).toEqual([0, 1]);
    expect(p.map((x) => x.nombre)).toEqual(["Cuello tortuga de cashmere", "Vestido de punto negro"]);
  });

  it("con menos de 2 prendas tuyas no hay looks, por más wishlist que haya", () => {
    expect(propiasEn(piezasDeCapsulaParaLooks([tengo, deseada], wish))).toBe(1);
    expect(propiasEn(piezasDeCapsulaParaLooks([tengo, tengo2, deseada], wish))).toBe(2);
  });
});
