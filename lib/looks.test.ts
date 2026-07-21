import { describe, it, expect } from "vitest";
import { computeTasteTags, LOOKS } from "./looks";

// Swipe sintético: like a los ids dados, dislike al resto del catálogo.
const swipeAll = (likedIds: string[]) =>
  LOOKS.map((l) => ({ id: l.id, liked: likedIds.includes(l.id) }));

describe("computeTasteTags — calibración √DF (v24)", () => {
  it("la preferencia consistente le gana a un ❤️ suelto de tag raro", () => {
    // 3 likes que comparten "pulido" (DF=5) + 1 like a "edgy" (DF=1), sin
    // dislikes que toquen "pulido". Con la calibración vieja (n/DF), edgy
    // (1.0) le ganaba a pulido (3/5 = 0.6); con √DF, pulido (3/√5 ≈ 1.34)
    // queda arriba.
    const tags = computeTasteTags([
      { id: "minimalista", liked: true },
      { id: "preppy", liked: true },
      { id: "smart-casual", liked: true },
      { id: "edgy", liked: true },
    ]);
    expect(tags.indexOf("pulido")).toBeGreaterThanOrEqual(0);
    expect(tags.indexOf("edgy")).toBeGreaterThanOrEqual(0);
    expect(tags.indexOf("pulido")).toBeLessThan(tags.indexOf("edgy"));
  });

  it("un tag raro con ❤️ sigue rankeando sobre señales débiles", () => {
    // Solo un like: edgy/atrevido/urbano. edgy (DF=1) debe salir primero.
    const tags = computeTasteTags(swipeAll(["edgy"]));
    expect(tags[0]).toBe("edgy");
  });

  it("máximo 8 tags y solo con señal neta positiva", () => {
    const likedAll = LOOKS.map((l) => ({ id: l.id, liked: true }));
    expect(computeTasteTags(likedAll).length).toBeLessThanOrEqual(8);
    const dislikedAll = LOOKS.map((l) => ({ id: l.id, liked: false }));
    expect(computeTasteTags(dislikedAll)).toEqual([]);
  });

  it("ids desconocidos se ignoran sin romper", () => {
    expect(computeTasteTags([{ id: "no-existe", liked: true }])).toEqual([]);
  });
});
