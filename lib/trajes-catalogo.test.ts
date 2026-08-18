import { describe, expect, it } from "vitest";
import { agruparTrajes, nombreDeTraje, type PiezaDeCatalogo } from "./trajes-catalogo";

const pieza = (
  id: number,
  name: string,
  category: string,
  conjunto?: string
): PiezaDeCatalogo => ({
  id,
  name,
  category,
  attrs: conjunto ? { conjunto } : {},
  image_path: `/archetypes/${id}.png`,
});

const CARBON = "c0a21321-b0de-4a11-9b71-000000000321";
const MARINO = "c0a11319-b0de-4a11-9b71-000000000319";

describe("nombreDeTraje", () => {
  it("quita el 'Saco de' y deja el traje", () => {
    expect(nombreDeTraje("Saco de traje gris carbón")).toBe("Traje gris carbón");
    expect(nombreDeTraje("Saco de smoking negro")).toBe("Smoking negro");
  });

  it("no destroza un nombre que no empieza con 'Saco de'", () => {
    expect(nombreDeTraje("Le smoking negro")).toBe("Le smoking negro");
  });
});

describe("agruparTrajes", () => {
  it("junta saco y pantalón del mismo conjunto en una sola tarjeta", () => {
    const { trajes, sueltas } = agruparTrajes([
      pieza(1, "Camiseta blanca", "top"),
      pieza(321, "Saco de traje gris carbón", "saco", CARBON),
      pieza(322, "Pantalón de traje gris carbón", "bottom", CARBON),
    ]);
    expect(trajes).toHaveLength(1);
    expect(trajes[0].nombre).toBe("Traje gris carbón");
    expect(trajes[0].piezas.map((p) => p.id).sort()).toEqual([321, 322]);
    // La camiseta sigue suelta; las dos piezas del traje YA NO — si siguieran,
    // se podrían marcar dos veces desde pestañas distintas.
    expect(sueltas.map((p) => p.id)).toEqual([1]);
  });

  it("la portada es el saco, aunque el pantalón venga primero", () => {
    const { trajes } = agruparTrajes([
      pieza(322, "Pantalón de traje gris carbón", "bottom", CARBON),
      pieza(321, "Saco de traje gris carbón", "saco", CARBON),
    ]);
    expect(trajes[0].portada.id).toBe(321);
  });

  it("no agrupa trajes distintos", () => {
    const { trajes } = agruparTrajes([
      pieza(321, "Saco de traje gris carbón", "saco", CARBON),
      pieza(322, "Pantalón de traje gris carbón", "bottom", CARBON),
      pieza(319, "Saco de traje azul marino", "saco", MARINO),
      pieza(320, "Pantalón de traje azul marino", "bottom", MARINO),
    ]);
    expect(trajes).toHaveLength(2);
  });

  it("una pieza sola NO hace traje: se queda en su categoría", () => {
    // El caso real de la biblioteca: ya tienes el saco, así que del traje sólo
    // te ofrece el pantalón. Tiene que verse en "Abajo", no como medio traje.
    const { trajes, sueltas } = agruparTrajes([
      pieza(322, "Pantalón de traje gris carbón", "bottom", CARBON),
    ]);
    expect(trajes).toHaveLength(0);
    expect(sueltas.map((p) => p.id)).toEqual([322]);
  });

  it("un conjunto sin saco no revienta: la portada es la primera pieza", () => {
    // Hoy todos los conjuntos del catálogo son saco+pantalón, pero el lazo es
    // genérico (un pants set de mujer no trae "saco"). La portada cae a la
    // primera pieza y el nombre no se destroza.
    const { trajes } = agruparTrajes([
      pieza(10, "Top de punto crema", "top", "abc123-set"),
      pieza(11, "Pantalón de punto crema", "bottom", "abc123-set"),
    ]);
    expect(trajes).toHaveLength(1);
    expect(trajes[0].portada.id).toBe(10);
    expect(trajes[0].nombre).toBe("Top de punto crema");
  });

  it("sin lazos, todo el catálogo sigue suelto", () => {
    const catalogo = [pieza(1, "Camiseta blanca", "top"), pieza(2, "Jeans", "bottom")];
    const { trajes, sueltas } = agruparTrajes(catalogo);
    expect(trajes).toHaveLength(0);
    expect(sueltas).toHaveLength(2);
  });
});
