import { describe, it, expect } from "vitest";
import { coloresCercanos, PALETA } from "./paleta-colores";

const nombres = (hex: string, n = 4) => coloresCercanos(hex, n).map((c) => c.name);

describe("los vecinos son los que de verdad se confunden", () => {
  it("el gris carbón del traje: negro y grises, nunca rosa", () => {
    // El caso de Roberto. Su traje es #3A3A3C: lo que puede confundirse es
    // negro / gris oscuro / gris, y ésas son las que deben ofrecerse.
    const v = nombres("#3A3A3C");
    expect(v).toContain("Gris oscuro");
    expect(v).toContain("Negro");
    expect(v).not.toContain("Rosa");
    expect(v).not.toContain("Beige");
  });

  it("un marino se confunde con negro, no con beige", () => {
    const v = nombres("#22304C");
    expect(v).toContain("Azul marino");
    expect(v).not.toContain("Beige");
    expect(v).not.toContain("Blanco");
  });

  it("un beige claro se confunde con blanco, no con negro", () => {
    const v = nombres("#D8CBB4");
    expect(v).toContain("Beige");
    expect(v).not.toContain("Negro");
  });

  it("el primero es siempre el más parecido", () => {
    expect(nombres("#1C1C1C")[0]).toBe("Negro");
    expect(nombres("#8B8B8B")[0]).toBe("Gris");
    expect(nombres("#5E2A33")[0]).toBe("Vino");
  });
});

describe("por qué la luminosidad pesa la mitad", () => {
  it("el carbón NO tiene al vino de vecino, aunque compartan claridad", () => {
    // Con las tres componentes pesando igual, el vecino más cercano del carbón
    // #3A3A3C salía "Vino" #5E2A33: comparten luminosidad casi exacta, y esa
    // coincidencia pesaba más que la diferencia de croma. A ojo nadie confunde
    // un carbón con un burdeos. Con kL = 2 —el factor que la CIE fija para
    // textiles— manda la familia de color, no la claridad.
    expect(nombres("#3A3A3C", 3)).not.toContain("Vino");
  });

  it("los vecinos del carbón son los oscuros neutros y el marino", () => {
    // Que el marino entre no es un defecto: "¿es carbón o azul medianoche?" es
    // de las confusiones más comunes en sastrería, y en una foto más todavía.
    const v = nombres("#3A3A3C", 3);
    expect(v).toContain("Gris oscuro");
    expect(v.filter((n) => ["Negro", "Azul marino"].includes(n))).not.toHaveLength(0);
  });
});

describe("nunca dejar a alguien sin salida", () => {
  it("sin hex legible se devuelven opciones igual", () => {
    // Quedarse sin ninguna sería peor que ofrecer unas cualesquiera: la
    // paleta completa sigue estando a un tap en la UI.
    expect(coloresCercanos(null)).toHaveLength(4);
    expect(coloresCercanos("no-es-un-hex")).toHaveLength(4);
  });

  it("pedir más de los que hay devuelve la paleta entera, sin repetir", () => {
    const v = coloresCercanos("#3A3A3C", 99);
    expect(v).toHaveLength(PALETA.length);
    expect(new Set(v.map((c) => c.name)).size).toBe(PALETA.length);
  });
});
