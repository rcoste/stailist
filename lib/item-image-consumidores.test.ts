import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Quién puede pintar prendas SIN pasar por lib/item-image.ts.
//
// EL BUG QUE MOTIVA ESTO
// El generador de outfits y el wow del onboarding leían la imagen de una prenda
// así:
//     .select("id, attrs")            →  imagen: attrs.image_path
// y eso funciona… solo para las prendas del catálogo. Una foto propia guarda su
// imagen en render_path/photo_path (bucket privado, hay que firmarla), y
// attrs.image_path viene vacío. Resultado: 252 de las 272 fotos propias de la
// base salían sin imagen en la generación — el 93%, en todos los usuarios.
//
// Y no fallaba: `?? null` convertía la ausencia en un hueco silencioso. Ninguna
// alerta, ningún 404 en logs. Solo cartas de outfit con el nombre de la prenda y
// un espacio vacío donde iba la foto.
//
// `lib/item-image.ts` existe justamente como fuente única del orden correcto
// (arquetipo → render → foto → prestada). Este test vigila que las pantallas que
// pintan prendas la usen, porque el modo de fallo es invisible.

const OBLIGADOS = [
  "app/api/generate/route.ts",
  "app/onboarding/wow/page.tsx",
  "app/closet/page.tsx",
  "app/hoy/page.tsx",
  "app/historial/page.tsx",
];

describe("consumidores de imágenes de prendas", () => {
  for (const archivo of OBLIGADOS) {
    it(`${archivo} usa lib/item-image`, () => {
      const src = readFileSync(archivo, "utf8");
      expect(
        /ITEM_IMAGE_SELECT|itemImageUrlSync|pickItemImage/.test(src),
        `${archivo} pinta prendas sin el helper: las fotos propias saldrán vacías`
      ).toBe(true);
    });
  }

  it("nadie lee attrs.image_path como si fuera la imagen final", () => {
    // El patrón exacto que causó el bug. Leer attrs.image_path está bien DENTRO
    // de item-image.ts (es la fuente "prestada", la última del orden); en
    // cualquier otro lado es saltarse las tres fuentes anteriores.
    const ofensores = OBLIGADOS.filter((f) =>
      /image_path.*\?\?\s*null|imagen:\s*\w+\.get\([^)]*\)\?\.image_path/.test(
        readFileSync(f, "utf8")
      )
    );
    expect(ofensores, "leen attrs.image_path directo").toEqual([]);
  });
});
