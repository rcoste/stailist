import { describe, it, expect } from "vitest";
import { aplicarReglasDelCruce, familiaDeColor } from "./capsule-match-reglas";
import type { CapsuleItem, ClosetItemLite, MatchEntry } from "@/lib/capsule";

// LO QUE BLINDA: los casos reales de la corrida en seco del 2026-10-18 sobre los
// 32 cruces guardados. Que el color no se sustituya fuera de los neutros oscuros
// y los vecinos; que una prenda no cubra dos piezas; que la prenda libre se
// ofrezca sólo cuando es de verdad de la misma clase.

const ideal = (nombre: string, colorFamilia: string, category = "top", tipo = "x"): CapsuleItem =>
  ({ nombre, tipo, colorFamilia, category, formalidad: "casual", temporada: "todo-el-año", prioridad: 1 }) as CapsuleItem;
const mia = (nombre: string, category = "top", color = ""): ClosetItemLite =>
  ({ id: nombre, nombre, category, color, formalidad: "casual" }) as ClosetItemLite;
const e = (status: MatchEntry["status"], by: string | null = null): MatchEntry => ({ status, by, difiere: null });

describe("familia de color", () => {
  it("azul oscuro, índigo y mezclilla son azul; marino es marino", () => {
    expect(familiaDeColor("azul oscuro")).toBe("azul");
    expect(familiaDeColor("azul-oscuro")).toBe("azul");
    expect(familiaDeColor("índigo")).toBe("azul");
    expect(familiaDeColor("azul marino")).toBe("marino");
    expect(familiaDeColor("chocolate")).toBe("cafe");
    expect(familiaDeColor("hueso")).toBe("crema");
  });
});

describe("regla 1 · el color", () => {
  it("el caso de su abrigo: negro no es parecido de chocolate", () => {
    const r = aplicarReglasDelCruce(
      [ideal("Abrigo largo de paño chocolate", "chocolate", "abrigo")],
      [e("parecido", "Abrigo largo negro")],
      [mia("Abrigo largo negro", "abrigo")]
    );
    expect(r.entries[0].status).toBe("falta");
  });

  it("el caso de su camiseta: negra no es parecido de blanca", () => {
    const r = aplicarReglasDelCruce([ideal("Camiseta blanca de algodón pima", "blanco")], [e("parecido", "Camiseta negra")], [mia("Camiseta negra")]);
    expect(r.entries[0].status).toBe("falta");
  });

  it("unos jeans azul oscuro siguen cubriendo unos jeans índigo", () => {
    const r = aplicarReglasDelCruce(
      [ideal("Jeans rectos azul índigo oscuro", "azul", "bottom")],
      [e("tienes", "Jeans azul oscuro")],
      [mia("Jeans azul oscuro", "bottom")]
    );
    expect(r.entries[0].status).toBe("tienes");
  });

  it("entre neutros oscuros distintos, 'tienes' baja a 'parecido'", () => {
    const r = aplicarReglasDelCruce([ideal("Camisa azul marino", "marino")], [e("tienes", "Camisa negra")], [mia("Camisa negra")]);
    expect(r.entries[0]).toMatchObject({ status: "parecido", by: "Camisa negra" });
  });

  it("los vecinos (camel y café, rubí y vino) se quedan en 'parecido'", () => {
    const r = aplicarReglasDelCruce(
      [ideal("Chamarra trucker camel", "camel", "abrigo"), ideal("Bufanda de lana rubí", "rubí", "accesorio")],
      [e("parecido", "Chamarra de piel café"), e("parecido", "Bufanda de lana vino")],
      [mia("Chamarra de piel café", "abrigo"), mia("Bufanda de lana vino", "accesorio")]
    );
    expect(r.entries.map((x) => x.status)).toEqual(["parecido", "parecido"]);
  });
});

describe("regla 2 · una prenda no cubre dos piezas", () => {
  it("si ya es 'tienes' en una, no es 'parecido' en otra", () => {
    const r = aplicarReglasDelCruce(
      [ideal("Pantalón de vestir gris", "gris", "bottom"), ideal("Pantalón de vestir azul marino", "marino", "bottom")],
      [e("tienes", "Pantalón de vestir gris"), e("parecido", "Pantalón de vestir gris")],
      [mia("Pantalón de vestir gris", "bottom")]
    );
    expect(r.entries.map((x) => x.status)).toEqual(["tienes", "falta"]);
  });
});

describe("regla 3 · la prenda libre se ofrece", () => {
  it("el caso de su abrigo: liberado del chocolate, se ofrece para el negro", () => {
    const r = aplicarReglasDelCruce(
      [ideal("Abrigo largo de paño chocolate", "chocolate", "abrigo"), ideal("Abrigo largo de lana negro", "negro", "abrigo")],
      [e("parecido", "Abrigo largo negro"), e("falta")],
      [mia("Abrigo largo negro", "abrigo")]
    );
    expect(r.entries[0].status).toBe("falta");
    expect(r.entries[1]).toMatchObject({ status: "parecido", by: "Abrigo largo negro" });
  });

  it("una prenda con el mismo nombre que la IA dejó como falta", () => {
    const r = aplicarReglasDelCruce([ideal("Medias opacas negras", "negro", "accesorio")], [e("falta")], [mia("Medias opacas negras", "accesorio")]);
    expect(r.entries[0]).toMatchObject({ status: "parecido", by: "Medias opacas negras" });
  });

  it("no ofrece disparates: un pantalón de traje no cubre un traje de baño, ni unos tenis una sandalia", () => {
    const r = aplicarReglasDelCruce(
      [ideal("Traje de baño negro liso", "negro", "accesorio"), ideal("Sandalia de piel negra", "negro", "calzado")],
      [e("falta"), e("falta")],
      [mia("Pantalón de traje negro", "bottom"), mia("Tenis de piel negros", "calzado")]
    );
    expect(r.entries.map((x) => x.status)).toEqual(["falta", "falta"]);
  });

  it("no ofrece una prenda que ya cubre otra pieza", () => {
    const r = aplicarReglasDelCruce(
      [ideal("Abrigo largo negro clásico", "negro", "abrigo"), ideal("Abrigo largo de lana negro", "negro", "abrigo")],
      [e("tienes", "Abrigo largo negro"), e("falta")],
      [mia("Abrigo largo negro", "abrigo")]
    );
    expect(r.entries[1].status).toBe("falta");
  });
});
