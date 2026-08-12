import { describe, expect, it } from "vitest";
import { MATERIALES, PATRONES_CHIP, conLeido, mismoHex } from "@/components/prenda-campos";

// LAS DOS FUNCIONES QUE SOSTIENEN LAS TRES PUERTAS DE ALTA.
//
// Desde que el vocabulario salió a su módulo, `conLeido` y `mismoHex` deciden
// lo mismo en el carrete, en el fit check y en la ficha del clóset — y no tenían
// un solo test directo. Corren en Node, sin DOM: son lógica pura.
//
// Lo que blindan no es cosmético. `conLeido` es lo que impide que un dato más
// específico que la lista (cashmere, gabardina) se vea como "no hay nada
// seleccionado" y se destruya con un tap; `mismoHex` es lo que hace que dos
// fuentes de color —la visión escribe "#1a1a1a", la paleta "#1A1A1A"— se
// reconozcan como el mismo negro.

describe("conLeido — el valor leído entra a la lista si no está", () => {
  it("un material fuera del catálogo entra PRIMERO", () => {
    const r = conLeido(MATERIALES, "gabardina");
    expect(r[0]).toEqual({ v: "gabardina", l: "gabardina" });
    expect(r).toHaveLength(MATERIALES.length + 1);
  });

  it("uno que ya está no se duplica", () => {
    expect(conLeido(MATERIALES, "lana")).toHaveLength(MATERIALES.length);
  });

  it("y tampoco distinguiendo mayúsculas o espacios", () => {
    // La otra mitad del contrato con `Escala`, que resalta con el mismo criterio.
    // Si aquí se antepusiera "Lana" y allá se resaltara "lana", habría DOS chips
    // para el mismo material y uno de los dos mentiría.
    expect(conLeido(MATERIALES, " Lana ")).toHaveLength(MATERIALES.length);
    expect(conLeido(PATRONES_CHIP, "RAYAS")).toHaveLength(PATRONES_CHIP.length);
  });

  it("sin valor leído, la lista tal cual", () => {
    expect(conLeido(MATERIALES, undefined)).toHaveLength(MATERIALES.length);
    expect(conLeido(MATERIALES, "   ")).toHaveLength(MATERIALES.length);
  });

  it("no muta la lista original", () => {
    // Son constantes de módulo compartidas por tres pantallas: un `unshift` en
    // vez de un `[nuevo, ...lista]` le metería "cashmere" al carrete de todos.
    const antes = MATERIALES.length;
    conLeido(MATERIALES, "cashmere");
    expect(MATERIALES).toHaveLength(antes);
  });
});

describe("mismoHex — el mismo color escrito de dos formas", () => {
  it("ignora mayúsculas y el gato", () => {
    expect(mismoHex("#1A1A1A", "#1a1a1a")).toBe(true);
    expect(mismoHex("1A1A1A", "#1A1A1A")).toBe(true);
  });

  it("colores distintos, false", () => {
    expect(mismoHex("#1A1A1A", "#F2F2F2")).toBe(false);
  });

  it("sin dato NO es 'iguales'", () => {
    // Dos ausencias no son una coincidencia: si `undefined === undefined` diera
    // true, una prenda sin color leído resaltaría el primer swatch como si
    // fuera el suyo.
    expect(mismoHex(undefined, undefined)).toBe(false);
    expect(mismoHex("#1A1A1A", undefined)).toBe(false);
    expect(mismoHex("", "")).toBe(false);
  });
});
