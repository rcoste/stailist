import { describe, expect, it } from "vitest";
import { esCampanaDePrueba, esPasoEmbudo, sujetoValido } from "@/lib/embudo-marcas";
import { resumirCampana, textoAvatar } from "@/lib/admin/campana";

// LO QUE SE BLINDA: que el embudo antes de la cuenta cuente lo que dice, y que
// nada de afuera (un id inventado, una campaña de prueba) se cuele al panel.

describe("marcas del embudo", () => {
  it("sólo acepta ids cortos y sin caracteres raros, y los cuatro pasos", () => {
    expect(sujetoValido("0b7c8a8e-2f3d-4a51-9a3b-6c1e2d3f4a5b")).toBe(true);
    expect(sujetoValido("corto")).toBe(false);
    expect(sujetoValido("<script>alert(1)</script>")).toBe(false);
    expect(sujetoValido(42)).toBe(false);
    expect(esPasoEmbudo("landing")).toBe(true);
    expect(esPasoEmbudo("correo_ok")).toBe(true);
    expect(esPasoEmbudo("compra")).toBe(false);
  });

  it("las campañas de prueba no cuentan", () => {
    expect(esCampanaDePrueba("prueba-borrador")).toBe(true);
    expect(esCampanaDePrueba("Prueba-X")).toBe(true);
    expect(esCampanaDePrueba("app-neutra")).toBe(false);
  });

  it("el resumen suma cada paso a su campaña, aunque nadie haya entrado todavía", () => {
    const [r] = resumirCampana({
      filas: [],
      extras: new Map(),
      codigos: [],
      gasto: [],
      embudo: [
        { fuente: "google", campana: "app-neutra", paso: "landing", n: 9 },
        { fuente: "google", campana: "app-neutra", paso: "boton", n: 3 },
        { fuente: "google", campana: "app-neutra", paso: "correo_visto", n: 2 },
        { fuente: "google", campana: "app-neutra", paso: "correo_ok", n: 1 },
      ],
      ahora: new Date("2026-10-05T12:00:00Z"),
    });
    expect([r.campana, r.landing, r.boton, r.correoVisto, r.correoOk]).toEqual(["app-neutra", 9, 3, 2, 1]);
    expect(r.entraron).toBe(0);
  });

  it("el avatar se dice en palabras", () => {
    expect(textoAvatar({ cara: 0, cuerpo: 0, guardaron: 0 })).toBe("nadie lo intentó");
    expect(textoAvatar({ cara: 1, cuerpo: 1, guardaron: 0 })).toBe("generaron la cara 1 · el cuerpo 1 · lo guardaron 0");
  });
});
