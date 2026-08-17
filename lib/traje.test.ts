import { describe, it, expect } from "vitest";
import { lazoDeTraje, veredictoDeTraje } from "./traje";

describe("lazoDeTraje — el indicador que Roberto pidió al votar", () => {
  // "Debería haber algún tipo de indicador visual para saber qué machea el
  // pantalón con el saco, porque si no está cabrón, no puedo saber si sí o no
  // va." En ese par había un saco de un traje con el pantalón de OTRO.
  const saco = { id: "saco", conjunto: "traje-A" };
  const pantA = { id: "pantA", conjunto: "traje-A" };
  const pantB = { id: "pantB", conjunto: "traje-B" };
  const camisa = { id: "camisa" };

  it("con su pareja en el look dice 'par'", () => {
    expect(lazoDeTraje(saco, [saco, pantA, camisa])).toBe("par");
    expect(lazoDeTraje(pantA, [saco, pantA, camisa])).toBe("par");
  });

  // EL CASO REAL: saco del traje A con el pantalón del traje B. Los dos vienen
  // de un traje, y ninguno está con el suyo.
  it("con el pantalón de OTRO traje dice 'solo' para los dos", () => {
    expect(lazoDeTraje(saco, [saco, pantB, camisa])).toBe("solo");
    expect(lazoDeTraje(pantB, [saco, pantB, camisa])).toBe("solo");
  });

  it("una prenda que no viene de ningún traje no dice nada", () => {
    expect(lazoDeTraje(camisa, [saco, pantA, camisa])).toBeNull();
  });

  // No se empareja consigo misma: sin el filtro por id, un saco solo diría "par".
  it("no se empareja consigo misma", () => {
    expect(lazoDeTraje(saco, [saco])).toBe("solo");
  });
});

describe("veredictoDeTraje — ¿el traje está bien apareado?", () => {
  // Roberto, aclarando para qué era el indicador: "esto es para identificar
  // visualmente que si el AI propone un traje completo, tipo para un abogado,
  // sí está haciendo el match correcto y no lo está haciendo parchado".
  const saco = { id: "s", nombre: "Saco de traje gris", conjunto: "A" };
  const pantA = { id: "pA", nombre: "Pantalón de traje gris", conjunto: "A" };
  const pantB = { id: "pB", nombre: "Pantalón de traje azul", conjunto: "B" };
  const camisa = { id: "c", nombre: "Camisa blanca" };
  const chinos = { id: "ch", nombre: "Chinos carbón" };

  it("saco y pantalón del mismo traje: completo", () => {
    expect(veredictoDeTraje([saco, pantA, camisa])?.tipo).toBe("completo");
  });

  // EL CASO REAL que motivó todo: en pantalla los dos grises se veían
  // plausibles y no había forma de saberlo.
  it("saco de un traje con pantalón de OTRO: parchado", () => {
    expect(veredictoDeTraje([saco, pantB, camisa])?.tipo).toBe("parchado");
  });

  // LA CORRECCIÓN DE LA v1: un saco de traje con chinos NO es "de otro traje"
  // —los chinos pueden ser perfectamente correctos— es que al saco le falta el
  // suyo. Decirlo mal era afirmar algo falso.
  it("saco de traje con chinos: suelto, y nombra la prenda", () => {
    const v = veredictoDeTraje([saco, chinos, camisa]);
    expect(v?.tipo).toBe("suelto");
    expect(v?.tipo === "suelto" && v.prenda).toBe("Saco de traje gris");
  });

  it("un look sin piezas de traje no dice nada", () => {
    expect(veredictoDeTraje([camisa, chinos])).toBeNull();
  });

  // Un traje de tres piezas (con chaleco) sigue siendo completo.
  it("tres piezas del mismo traje siguen siendo completo", () => {
    const chaleco = { id: "ch2", nombre: "Chaleco gris", conjunto: "A" };
    expect(veredictoDeTraje([saco, pantA, chaleco])?.tipo).toBe("completo");
  });
});
