import { describe, expect, it } from "vitest";
import { REVISIONES } from "./destilador-tipos";

describe("segunda vuelta del destilador", () => {
  // La razón de existir de toda la segunda pasada: "es del estilo pero no es lo
  // mío" TIENE que devolver la foto a la destilación. Si alguien le pone
  // destila:false —por simetría con las otras dos, que parece lo natural— la
  // pantalla sigue funcionando igual, nadie ve un error, y el recetario vuelve
  // en silencio a describir el guardarropa de una persona en vez del estilo.
  //
  // La medición que motivó esto: 35% de acuerdo con la taxonomía en
  // smart-casual, con 17 de 26 fotos rechazadas que sí eran del estilo.
  it("solo 'no es lo mío' devuelve la foto a la destilación", () => {
    const destilan = REVISIONES.filter((r) => r.destila);
    expect(destilan).toHaveLength(1);
    expect(destilan[0].id).toBe("no-es-lo-mio");
  });

  it("las otras dos salidas descartan", () => {
    for (const id of ["mal-ejecutada", "no-es-del-estilo"]) {
      const r = REVISIONES.find((x) => x.id === id);
      expect(r, `falta la salida ${id}`).toBeDefined();
      expect(r!.destila).toBe(false);
    }
  });

  it("cada salida se explica sola", () => {
    // Se leen en el celular y deciden si una foto entra al recetario: una
    // etiqueta ambigua reproduce el error que esta pantalla vino a corregir.
    for (const r of REVISIONES) {
      expect(r.label.length).toBeGreaterThan(10);
      expect(r.pista.length).toBeGreaterThan(10);
    }
  });
});
