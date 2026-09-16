import { describe, expect, it } from "vitest";
import { looksForGender } from "@/lib/looks";
import { resumirMazo, type FilaMazo } from "./mazo";

const [primera, segunda] = looksForGender("hombre");

describe("resumirMazo", () => {
  const filas: FilaMazo[] = [
    { gender: "hombre", llego: true, termino: true, escape: "false", votos: [{ id: primera.id, liked: true }, { id: segunda.id, liked: false }] },
    { gender: "hombre", llego: true, termino: false, escape: null, votos: null },
    { gender: "hombre", llego: true, termino: true, escape: "true", votos: [{ id: primera.id, liked: true }] },
    // Cuenta de antes de la pantalla de edad: no se sabe si llegó, no inventa abandono.
    { gender: "hombre", llego: false, termino: true, escape: null, votos: [{ id: segunda.id, liked: true }] },
  ];
  const [hombres] = resumirMazo(filas);

  it("abandono = llegó al swipe y no lo terminó", () => {
    expect(hombres.llegaron).toBe(3);
    expect(hombres.terminaron).toBe(2);
  });

  it("cuenta el escape y el % de likes sobre todos los votos", () => {
    expect(hombres.escape).toBe(1);
    expect(hombres.conVotos).toBe(3);
    expect(hombres.pctLikes).toBe(75); // 3 likes de 4 votos
  });

  it("las cartas van en el orden ACTUAL del mazo, con sus votos", () => {
    expect(hombres.cartas[0]).toMatchObject({ posicion: 1, id: primera.id, votos: 2, likes: 2 });
    expect(hombres.cartas[1]).toMatchObject({ posicion: 2, id: segunda.id, votos: 2, likes: 1 });
  });
});
