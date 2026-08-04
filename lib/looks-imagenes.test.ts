import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOOKS, LOOKS_V, looksForGender } from "./looks";

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

// Las rutas llevan un rompe-caché (`?v=N`, ver lib/looks.ts): en disco no
// existe ese sufijo, así que se quita antes de comprobar el archivo.
const publicPath = (src: string) => `public${src.split("?")[0]}`;

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
      expect(l.image?.split("?")[0]).toBe(`/looks/${l.id}.png`);
      expect(existsSync(`public/looks/${l.id}-mujer.png`)).toBe(false);
      expect(existsSync(`public/looks/${l.id}-hombre.png`)).toBe(false);
    }
  });
});

describe("rompe-caché de las imágenes del deck", () => {
  // Sin esto, rehacer una carta no se ve: el archivo conserva su nombre, el
  // navegador cree que es la misma imagen de siempre y sirve la que tenía
  // guardada. Pasó de verdad — se rehicieron las 25 cartas de hombre y en el
  // teléfono seguían saliendo las viejas.
  it("todas las rutas llevan versión", () => {
    for (const gender of ["hombre", "mujer"] as const) {
      for (const l of looksForGender(gender)) {
        expect(l.image, `${l.id} (${gender}) sin ?v=`).toMatch(/\?v=\d+$/);
      }
    }
  });

  // El otro lado del acople, y el que ya reventó producción: el componente
  // <Image> valida la query contra images.localPatterns con igualdad EXACTA y
  // LANZA en render si no casa — la pantalla completa se cae, no solo la
  // imagen. La primera versión de este test pedía `search: ""` creyendo que
  // era un comodín; `search: ""` significa "sin query" y rechazaba el ?v=.
  //
  // Y no basta con probar el endpoint del optimizador: ese responde 200 igual.
  // Por eso lo que se comprueba aquí es que la config declare EXACTAMENTE la
  // misma versión que arman las rutas.
  it("next.config declara la MISMA versión que usan las rutas", async () => {
    const cfg = await import("../next.config");
    const patrones = cfg.default.images?.localPatterns ?? [];
    const looks = patrones.find((p) => p.pathname === "/looks/**");
    expect(looks, "falta el patrón /looks/** en images.localPatterns").toBeDefined();
    expect(
      looks!.search,
      `la config permite "${looks!.search}" pero las rutas piden "?v=${LOOKS_V}"`
    ).toBe(`?v=${LOOKS_V}`);
  });
});
