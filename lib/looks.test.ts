import { describe, it, expect } from "vitest";
import { computeTasteTags, LOOKS, looksForGender, apetitoDeAcentos } from "./looks";

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

describe("el mazo arranca contrastando", () => {
  // POR QUÉ ESTA GUARDA: el orden del archivo está agrupado por familia para
  // que se lea bien, y eso hacía que las seis primeras cartas fueran todas
  // pulido/clásico — idénticas para todo el mundo, porque el mazo no se baraja.
  // El round-robin de porContraste lo arregla, pero es invisible: quien añada
  // una carta no tiene por qué saber que existe. Esto lo hace visible.
  const LIMPIO = ["minimalista", "clasico", "pulido", "estructurado", "preppy", "sobrio"];

  for (const g of ["hombre", "mujer"] as const) {
    it(`${g}: las 10 primeras no son todas del mismo palo`, () => {
      const diez = looksForGender(g).slice(0, 10);
      const limpias = diez.filter((l) => l.tags.some((t) => LIMPIO.includes(t)));
      // Antes eran 6 de 10; hoy son 3. Cuatro deja margen sin permitir la recaída.
      expect(limpias.length).toBeLessThanOrEqual(4);
    });

    it(`${g}: las 5 primeras cubren al menos 4 familias distintas`, () => {
      const cinco = looksForGender(g).slice(0, 5);
      const tags = new Set(cinco.flatMap((l) => l.tags));
      // Proxy de "familias": con 5 cartas de palos distintos salen ≥12 tags;
      // con 5 del mismo cluster se repiten y bajan de 10.
      expect(tags.size).toBeGreaterThanOrEqual(12);
    });
  }

  it("mujer: la carta del eje 'marca la silueta' no queda enterrada", () => {
    // `de-salir` se añadió porque Tatiana señaló que faltaba ese eje, y había
    // quedado en la posición 27 de 27 — el parche puesto donde no se ve.
    const i = looksForGender("mujer").findIndex((l) => l.id === "de-salir");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(18);
  });
});

describe("apetitoDeAcentos — derivado de los swipes, sin tocar el onboarding", () => {
  const sw = (ids: string[], liked = true) => ids.map((id) => ({ id, liked }));
  it("el caso real de Roberto: 2 audaces / 5 discretas → discreto", () => {
    expect(
      apetitoDeAcentos([
        ...sw(["edgy", "streetwear"]),
        ...sw(["minimalista", "monocromatico", "clasico-elegante", "coreano", "tonos-tierra"]),
      ])
    ).toBe("discreto");
  });
  it("protagonista pide ventaja de 2; una carta de diferencia es medio (ruido de mazo)", () => {
    expect(apetitoDeAcentos(sw(["color-protagonista", "glam-noche"]))).toBe("protagonista");
    expect(apetitoDeAcentos([...sw(["color-protagonista"]), ...sw(["minimalista"], true)])).toBe("medio");
  });
  it("los dislikes no cuentan y las cartas neutras tampoco", () => {
    expect(apetitoDeAcentos([...sw(["glam-noche", "y2k"], false), ...sw(["preppy", "nautico"])])).toBe("medio");
  });
  it("las listas solo nombran cartas que existen en el mazo (contrato con ESTILOS)", () => {
    for (const l of LOOKS) expect(typeof l.id).toBe("string");
    const ids = new Set(LOOKS.map((l) => l.id));
    for (const id of ["color-protagonista","glam-noche","y2k","de-salir","edgy","streetwear","minimalista","monocromatico","clasico-elegante","coreano","tonos-tierra"])
      expect(ids.has(id), id).toBe(true);
  });
});
