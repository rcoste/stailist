import { describe, it, expect } from "vitest";
import { ejemploDeTalla } from "@/lib/prenda-atributos";

describe("ejemploDeTalla — el formato cambia con la prenda", () => {
  it("un saco se habla en números de pecho, no en letras", () => {
    // Roberto: "para sacos o trajes es 42, 44, 50". Sugerirle S/M/L ahí sería
    // pedirle un dato que su saco no tiene escrito en ninguna parte.
    expect(ejemploDeTalla("saco")).toMatch(/\d/);
    expect(ejemploDeTalla("saco")).not.toMatch(/\bS, M\b/);
  });

  it("el calzado tiene el suyo", () => {
    expect(ejemploDeTalla("calzado")).toContain("27");
  });

  it("un top va por letra", () => {
    expect(ejemploDeTalla("top")).toContain("S");
  });

  it("sin categoría no truena — cae a letras", () => {
    expect(ejemploDeTalla(null)).toBeTruthy();
    expect(ejemploDeTalla(undefined)).toBeTruthy();
    expect(ejemploDeTalla("")).toBeTruthy();
  });

  it("es un EJEMPLO, no una lista cerrada", () => {
    // Nada valida contra esto: las tallas del mundo real son un desastre y un
    // campo que rechaza lo que dice la etiqueta de SU prenda estaría
    // equivocado él, no ella. Si algún día se valida, este test se cae.
    for (const c of ["saco", "calzado", "top", "bottom", "accesorio"])
      expect(ejemploDeTalla(c)).toMatch(/…$/);
  });
});
