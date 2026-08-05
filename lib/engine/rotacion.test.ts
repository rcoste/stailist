import { describe, it, expect } from "vitest";
import { calcularRotacion, bloqueRotacion } from "./rotacion";
import type { EngineItem } from "./prompt";

const p = (nombre: string): EngineItem => ({
  id: nombre.toLowerCase().replace(/\s+/g, "-"),
  attrs: { nombre, color_hex: "#808080" },
});

const closet = [
  p("Chinos carbón"),
  p("Jeans azul oscuro"),
  p("Camisa oxford blanca"),
  p("Suéter marino"),
  p("Polo gris"),
  p("Tenis blancos"),
];

describe("rotación del clóset", () => {
  it("sin historial NO dice nada — no hay rotación posible", () => {
    // Con el clóset entero "descansado", nombrarlo completo no le informa nada
    // al motor y solo gasta prompt.
    const r = calcularRotacion(closet, []);
    expect(r.descansadas).toEqual([]);
    expect(bloqueRotacion(r)).toBe("");
  });

  it("separa lo que descansó de lo que se vio mucho", () => {
    const historial = [
      ["chinos-carbón", "camisa-oxford-blanca", "tenis-blancos"],
      ["chinos-carbón", "suéter-marino", "tenis-blancos"],
      ["chinos-carbón", "camisa-oxford-blanca", "tenis-blancos"],
    ];
    const r = calcularRotacion(closet, historial);
    expect(r.descansadas.map((x) => x.attrs.nombre)).toEqual([
      "Jeans azul oscuro",
      "Polo gris",
    ]);
    // 3 apariciones en el historial es el umbral de "muy vista".
    expect(r.muyVistas.map((x) => x.attrs.nombre)).toContain("Chinos carbón");
    expect(r.muyVistas.map((x) => x.attrs.nombre)).not.toContain("Suéter marino");
  });

  it("el bloque dice que es un DESEMPATE, no una cuota", () => {
    // La diferencia importa: empujar una prenda a un look donde no cabe es peor
    // que repetir. Repetir se nota a la semana; forzar se nota al ponérselo.
    const r = calcularRotacion(closet, [["chinos-carbón", "tenis-blancos"]]);
    const b = bloqueRotacion(r);
    expect(b).toContain("desempate");
    expect(b).toContain("NO una cuota");
    expect(b).toContain("úsala sin problema");
  });

  it("nombra las descansadas para que el motor tenga a DÓNDE ir", () => {
    // Decir solo lo que sobra empuja a evitar sin dar alternativa, y de ahí
    // salen los looks raros.
    const r = calcularRotacion(closet, [["chinos-carbón"]]);
    expect(bloqueRotacion(r)).toContain("Jeans azul oscuro");
  });
});
