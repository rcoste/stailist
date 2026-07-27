import { describe, it, expect } from "vitest";
import {
  claseAccesorio,
  closetItemLine,
  contextoUso,
  contextosCompatibles,
  matchSignature,
} from "./capsule-match";
import { closetSignature, type ClosetItemLite } from "@/lib/capsule";

const c = (over: Partial<ClosetItemLite> = {}): ClosetItemLite => ({
  id: "i1",
  nombre: "Suéter marino",
  category: "top",
  color: "marino",
  formalidad: "formal-casual",
  ...over,
});

describe("closetItemLine — línea del clóset con atributos ricos (v25)", () => {
  it("prenda vieja (solo campos base): categoría, formalidad, color", () => {
    expect(closetItemLine(c())).toBe("- Suéter marino (top, formal-casual, marino)");
  });

  it("con hex, material, temporada y corte: todo entra en orden, omite vacíos", () => {
    const line = closetItemLine(
      c({
        color_hex: "#1F3A5F",
        material: "lana",
        temporada: "frio",
        corte: "recto",
      })
    );
    expect(line).toBe(
      "- Suéter marino (top, formal-casual, marino #1F3A5F, lana, corte recto, para frio)"
    );
  });

  it('patrón "liso" y temporada "todo-el-año" se omiten (no aportan)', () => {
    const line = closetItemLine(c({ patron: "liso", temporada: "todo-el-año" }));
    expect(line).toBe("- Suéter marino (top, formal-casual, marino)");
  });

  it('estampado real se anuncia como "estampado X"; el genérico no se duplica', () => {
    expect(closetItemLine(c({ patron: "rayas" }))).toContain("estampado rayas");
    expect(closetItemLine(c({ patron: "estampado" }))).toContain("estampado");
    expect(closetItemLine(c({ patron: "estampado" }))).not.toContain("estampado estampado");
  });

  it("color secundario se pega al color", () => {
    expect(closetItemLine(c({ color_secundario: "blanco" }))).toContain("marino con blanco");
  });
});


// El guard de zona no alcanza dentro de "accesorio": reloj y lentes son ambos
// accesorio y el match los dio por intercambiables en prod (screenshot de
// Roberto). Esta clase fina es la red en código; el prompt solo lo pedía.
describe("claseAccesorio — reloj ≠ lentes ≠ cinturón", () => {
  it("distingue las clases que se confundían", () => {
    expect(claseAccesorio("Reloj de acero con detalles en oro")).toBe("reloj");
    expect(claseAccesorio("Lentes redondos")).toBe("lentes");
  });

  it("aguanta acentos y mayúsculas", () => {
    expect(claseAccesorio("CINTURÓN de piel café")).toBe("cinturon");
    expect(claseAccesorio("Gafas de sol")).toBe("lentes");
  });

  it("cubre el resto del vocabulario de accesorios", () => {
    expect(claseAccesorio("Bufanda de lana")).toBe("bufanda");
    expect(claseAccesorio("Gorra de béisbol")).toBe("sombrero");
    expect(claseAccesorio("Cartera de piel")).toBe("bolsa");
    expect(claseAccesorio("Collar delgado de oro")).toBe("joyeria");
    expect(claseAccesorio("Corbata de seda vino")).toBe("corbata");
  });

  it("clase desconocida devuelve null (no bloquea: mejor pasar que falsear hueco)", () => {
    expect(claseAccesorio("Accesorio raro sin nombre claro")).toBeNull();
  });
});

describe("contextoUso — lo que no es ropa de calle no cubre ropa de calle", () => {
  it("el bug de Roberto: su short de BAÑO no cubre el short de lino de la cápsula", () => {
    expect(contextosCompatibles("Short de lino marino short", "Short de baño marino")).toBe(
      false
    );
  });

  it("dos prendas de baño sí se cubren entre ellas", () => {
    expect(contextosCompatibles("Traje de baño marino", "Short de baño negro")).toBe(true);
    expect(contextoUso("Bikini de dos piezas")).toBe("bano");
  });

  it("ropa de calle con ropa de calle no se bloquea", () => {
    expect(contextosCompatibles("Short de lino marino", "Bermuda de algodón azul")).toBe(true);
    expect(contextoUso("Chinos azul marino")).toBe(null);
  });

  it("pijama, ropa interior y gym tienen su propio contexto", () => {
    expect(contextoUso("Pijama de algodón")).toBe("dormir");
    expect(contextoUso("Bóxer de algodón")).toBe("interior");
    expect(contextoUso("Playera de gym")).toBe("gym");
    expect(contextosCompatibles("Camiseta blanca de algodón", "Playera para correr")).toBe(
      false
    );
  });

  it("NO se cuelga de palabras ambiguas: 'deportivo'/'sport' siguen siendo de calle", () => {
    // Un falso hueco es tan malo como un falso "ya lo tienes": si estas palabras
    // dispararan el guard, un reloj deportivo dejaría de cubrir un reloj.
    expect(contextoUso("Reloj deportivo de acero")).toBe(null);
    expect(contextoUso("Saco sport gris carbón")).toBe(null);
    expect(contextosCompatibles("Reloj de acero", "Reloj deportivo negro")).toBe(true);
  });
});

describe("matchSignature — una sola firma para el match Y los looks", () => {
  const closet = [
    { id: "a", category: "top", formalidad: "casual", color: "blanco" },
    { id: "b", category: "bottom", formalidad: "casual", color: "negro" },
  ];

  it("lleva la versión del prompt por delante de la firma del clóset", () => {
    // El banner "cambiaste tu clóset — actualiza tus looks" quedaba pegado porque
    // los looks se guardaban con closetSignature() y la página comparaba contra
    // matchSignature(): nunca coincidían. Si vuelven a divergir, esto lo caza.
    expect(matchSignature(closet)).toBe(`m5|${closetSignature(closet)}`);
    expect(matchSignature(closet)).not.toBe(closetSignature(closet));
  });

  it("es estable entre llamadas con el mismo clóset", () => {
    expect(matchSignature(closet)).toBe(matchSignature([...closet]));
  });
});
