import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOOKS, looksForGender } from "./looks";

// Cada carta del swipe TIENE que tener su archivo de imagen en public/.
//
// El bug que motiva este test mordió dos veces en el mismo día: las cartas
// women-only (`coquette`, `de-salir`) NO llevan sufijo de género en el archivo
// —looksForGender las lee como /looks/<id>.png— pero el generador escribía
// "<id>-mujer.png". Resultado: una imagen nueva en un archivo que nadie lee, y
// la carta seguía mostrando la vieja SIN QUE NADA FALLARA. Ni un error, ni un
// 404 visible en la corrida: solo una carta que no cambió.
//
// Es el peor tipo de bug — el que se ve como "la generación no quedó bien" y te
// manda a re-generar imágenes en vez de a revisar el nombre del archivo.

const publicPath = (src: string) => `public${src}`;

describe("imágenes del deck de swipes", () => {
  for (const gender of ["hombre", "mujer"] as const) {
    it(`el deck de ${gender} tiene todas sus imágenes en disco`, () => {
      const faltantes = looksForGender(gender)
        .map((l) => l.image)
        .filter((src): src is string => !!src)
        .filter((src) => !existsSync(publicPath(src)));
      expect(faltantes).toEqual([]);
    });
  }

  it("las cartas de un solo género NO usan sufijo de género", () => {
    // Si alguien agrega un estilo segment:"mujer" y le pone <id>-mujer.png, el
    // archivo existe pero la app nunca lo pide. Este caso lo cachamos aquí.
    const soloUnGenero = LOOKS.filter((l) => l.segment !== "unisex");
    expect(soloUnGenero.length).toBeGreaterThan(0);
    for (const l of soloUnGenero) {
      expect(l.image).toBe(`/looks/${l.id}.png`);
      expect(existsSync(`public/looks/${l.id}-mujer.png`)).toBe(false);
      expect(existsSync(`public/looks/${l.id}-hombre.png`)).toBe(false);
    }
  });
});
