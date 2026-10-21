import { describe, it, expect } from "vitest";
import { textoDeBase } from "@/lib/engine/trip-capsule";
import { capsuleFloor } from "@/lib/trip";

// LO QUE BLINDA: lo que el motor lee sobre las prendas base (2026-10-21). Su
// maleta de 8 días salió con 5 camisas y playeras porque el piso contaba los
// suéteres como tops; ahora el motor lee cuántas van pegadas a la piel y por qué.

describe("textoDeBase", () => {
  it("su caso: 8 días, se cambia seguido → 10 base, con el porqué", () => {
    const t = textoDeBase(capsuleFloor(8, ["ciudad", "noche"], 27, { cambio: "seguido" }), 8);
    expect(t).toContain("al menos 10 deben ser PRENDAS BASE");
    expect(t).toContain("se cambia seguido");
    expect(t).toContain("Los suéteres");
  });

  it("si lava en un viaje largo, dice que la cuenta es de una semana", () => {
    const t = textoDeBase(capsuleFloor(27, ["ciudad"], 34, { cambio: "seguido", lavar: true }), 27);
    expect(t).toContain("al menos 9");
    expect(t).toContain("va a lavar");
  });

  it("si no cabe, lo dice como límite del equipaje", () => {
    const t = textoDeBase(capsuleFloor(8, ["ciudad"], 11, { cambio: "repito", lavar: false }), 8);
    expect(t).toContain("no le caben 8");
  });
});
