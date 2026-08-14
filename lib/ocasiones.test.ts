import { describe, expect, it } from "vitest";
import { PERFILES_OCASION, reconocerOcasion } from "./ocasiones";

describe("reconocerOcasion — lo que la persona escribe", () => {
  // Los dos planes REALES que fallaron en producción el 2026-08-14. Son el
  // motivo del archivo, así que son el primer test.
  it("reconoce los dos viñedos que salieron mal en producción", () => {
    expect(reconocerOcasion("Ida a viñedos con mis amigos")?.key).toBe("campo");
    expect(
      reconocerOcasion("Ir a un viñedo en este en Tequisquiapan con mis amigos")?.key
    ).toBe("campo");
  });

  it("reconoce el tercer plan libre de la historia: el gym", () => {
    expect(reconocerOcasion("Día de ejercicio")?.key).toBe("ejercicio");
  });

  it("aguanta sin acentos y en mayúsculas — nadie escribe con cuidado", () => {
    expect(reconocerOcasion("VINEDO CON AMIGOS")?.key).toBe("campo");
    expect(reconocerOcasion("dia de campo")?.key).toBe("campo");
  });

  it("rancho y hacienda también son campo", () => {
    expect(reconocerOcasion("fin de semana en el rancho")?.key).toBe("campo");
    expect(reconocerOcasion("boda en una hacienda")?.key).toBe("campo");
  });

  it("la playa hereda el piso de formalidad que ya existía", () => {
    const p = reconocerOcasion("nos vamos a la playa");
    expect(p?.key).toBe("playa");
    expect(p?.formalidadPiso).toBe("playa");
  });

  it("caminata y montaña son naturaleza, no campo", () => {
    expect(reconocerOcasion("una caminata al cerro")?.key).toBe("naturaleza");
    expect(reconocerOcasion("senderismo el domingo")?.key).toBe("naturaleza");
  });

  // "bodega" en México es un almacén, no una vinícola. Meterla haría que
  // "tengo que ir a la bodega" saliera vestido de viñedo.
  it("NO confunde bodega con vinícola", () => {
    expect(reconocerOcasion("recoger unas cajas en la bodega")).toBeNull();
  });

  it("lo que no reconoce no estorba: devuelve null y el texto sigue su camino", () => {
    expect(reconocerOcasion("una junta con el contador")).toBeNull();
    expect(reconocerOcasion("")).toBeNull();
    expect(reconocerOcasion(null)).toBeNull();
    expect(reconocerOcasion("   ")).toBeNull();
  });
});

describe("el catálogo describe situaciones, no atuendos", () => {
  // El guardrail del archivo, como test y no como buena intención. Si alguien
  // (yo) escribe "ponte guayabera" en una situación, esto lo caza: la regla es
  // que el motor deduzca la prenda del hecho, con el clóset de la persona
  // delante — no que este archivo se la dicte.
  const PRENDAS_PROHIBIDAS =
    /\b(guayabera|sombrero|huarache|blazer|saco|jeans|playera|camisa|vestido|falda|tenis|botas?|mocasines|shorts?|bermuda)\b/i;

  for (const p of PERFILES_OCASION) {
    it(`"${p.key}" no prescribe prendas`, () => {
      expect(p.situacion).not.toMatch(PRENDAS_PROHIBIDAS);
    });
  }

  it("todas las claves son únicas", () => {
    const keys = PERFILES_OCASION.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ningún perfil se come a otro: cada uno gana con sus propias palabras", () => {
    // El orden del catálogo decide en caso de empate, así que vale la pena
    // fijar que hoy no hay empates entre las frases canónicas de cada perfil.
    const canonicas: Record<string, string> = {
      campo: "vamos al viñedo",
      naturaleza: "vamos de caminata",
      playa: "vamos a la playa",
      ejercicio: "voy al gimnasio",
    };
    for (const [key, frase] of Object.entries(canonicas)) {
      expect(reconocerOcasion(frase)?.key).toBe(key);
    }
  });
});
