import { describe, expect, it } from "vitest";
import { REVISIONES } from "./destilador-tipos";

describe("segunda vuelta del destilador", () => {
  // La razón de existir de toda la segunda pasada: "es del estilo pero no es lo
  // mío" TIENE que devolver la foto a la destilación. Si alguien le pone
  // destila:false —por simetría con las que descartan, que parece lo natural— la
  // pantalla sigue funcionando igual, nadie ve un error, y el recetario vuelve
  // en silencio a describir el guardarropa de una persona en vez del estilo.
  //
  // La medición que motivó esto: 35% de acuerdo con la taxonomía en
  // smart-casual, con 17 de 26 fotos rechazadas que sí eran del estilo.
  it("'no es lo mío' devuelve la foto a la destilación", () => {
    const r = REVISIONES.find((x) => x.id === "no-es-lo-mio");
    expect(r, "falta la salida no-es-lo-mio").toBeDefined();
    expect(r!.destila).toBe(true);
  });

  // Sin esta salida, rescatar una foto descartada por error del dedo obligaba a
  // pasar por "no es lo mío", que escribe mio = false. O sea: para corregir el
  // descarte había que mentir sobre el gusto, en el único campo que distingue el
  // estilo del guardarropa de quien cura.
  it("se puede rescatar una foto sin declarar que no gusta", () => {
    const r = REVISIONES.find((x) => x.id === "me-equivoque");
    expect(r, "falta la salida me-equivoque").toBeDefined();
    expect(r!.destila).toBe(true);
    expect(r).toHaveProperty("mio", true);
  });

  it("las salidas que descartan no opinan del gusto", () => {
    for (const id of ["mal-ejecutada", "no-es-del-estilo"]) {
      const r = REVISIONES.find((x) => x.id === id);
      expect(r, `falta la salida ${id}`).toBeDefined();
      expect(r!.destila).toBe(false);
      // Descartar no dice nada sobre si gusta: si estas llevaran `mio`, la
      // acción lo escribiría y borraría el gusto ya registrado.
      expect(r).not.toHaveProperty("mio");
    }
  });

  // Cada salida que destila tiene que declarar el gusto, porque la acción lo
  // escribe desde aquí. Una salida nueva sin `mio` guardaría el rescate y
  // perdería el gusto en silencio.
  it("toda salida que destila declara el gusto", () => {
    for (const r of REVISIONES.filter((x) => x.destila)) {
      expect(r, `${r.id} destila pero no declara mio`).toHaveProperty("mio");
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
