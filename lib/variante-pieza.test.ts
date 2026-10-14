import { describe, it, expect } from "vitest";
import { cambiarColor, cambiarMetal, colorDeNombre, metalDeNombre, tieneHerraje } from "@/lib/variante-pieza";

describe("cambiarMetal — el caso real", () => {
  it("hebilla dorada → plateada, respetando el género", () => {
    expect(cambiarMetal("Cinturón negro con hebilla dorada", "plateado")).toBe("Cinturón negro con hebilla plateada");
    expect(cambiarMetal("Bolsa cruzada con herrajes dorados", "plateado")).toBe("Bolsa cruzada con herrajes plateados");
  });
  it("si el nombre no dice metal, lo agrega en la forma natural", () => {
    expect(cambiarMetal("Cinturón negro de piel", "plateado")).toBe("Cinturón negro de piel con hebilla plateada");
    expect(cambiarMetal("Bolsa cruzada negra", "dorado")).toBe("Bolsa cruzada negra con herrajes dorados");
  });
  it("sin herraje quita la frase entera", () => {
    expect(cambiarMetal("Cinturón negro con hebilla dorada", "sin")).toBe("Cinturón negro");
  });
  it("lee el metal del nombre", () => {
    expect(metalDeNombre("Cinturón negro con hebilla dorada")).toBe("dorado");
    expect(metalDeNombre("Bolsa negra")).toBeNull();
  });
});

describe("cambiarColor", () => {
  it("respeta el género de la palabra", () => {
    expect(cambiarColor("Cinturón negro con hebilla dorada", "café")).toBe("Cinturón café con hebilla dorada");
    expect(cambiarColor("Bolsa cruzada negra", "blanco")).toBe("Bolsa cruzada blanca");
    expect(cambiarColor("Suéter de punto chocolate", "negro")).toBe("Suéter de punto negro");
    // Visto al probarlo: el color viejo no llevaba género y salía "Camisa negro".
    expect(cambiarColor("Camisa chocolate de algodón", "negro")).toBe("Camisa negra de algodón");
    expect(cambiarColor("Mocasines de piel chocolate", "negro")).toBe("Mocasines de piel negros");
    expect(cambiarColor("Botas de lluvia café", "blanco")).toBe("Botas de lluvia blancas");
  });
  it("sin color en el nombre, no inventa", () => {
    expect(cambiarColor("Trench impermeable", "negro")).toBe("Trench impermeable");
    expect(colorDeNombre("Trench impermeable")).toBeNull();
  });
});

describe("tieneHerraje", () => {
  it("cinturones, bolsas y joyería sí; un suéter no", () => {
    expect(tieneHerraje("Cinturón negro")).toBe(true);
    expect(tieneHerraje("Bolsa cruzada de piel negra")).toBe(true);
    expect(tieneHerraje("Suéter de cashmere vino")).toBe(false);
  });
});
