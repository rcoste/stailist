import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { imagenDestino } from "./destino-imagen";

// El candado del OTRO modo de fallo de la card de viaje.
//
// destino-imagen.test.ts prueba que se elija el destino correcto; esto prueba
// que ese destino EXISTA en disco. Son fallas distintas y la segunda es más
// silenciosa: `imagenDestino` nunca devuelve null —siempre contesta una ruta—,
// así que un slug sin su .webp no truena nada, no aparece en ningún log del
// server y solo se ve como un hueco gris en la card, todos los días.
//
// Pasa fácil: los slugs se escriben a mano en el catálogo y las imágenes las
// genera un script aparte (scripts/gen-destinos.mjs). Agregar "lisboa" al
// catálogo sin correr el script deja exactamente ese hueco.

const RAIZ = join(import.meta.dirname, "..");
const CARPETA = join(RAIZ, "public", "destinos");

// Los slugs se leen del código fuente porque DESTINOS no se exporta (y no tiene
// por qué: nadie más lo necesita). Los dos fallbacks van a mano — son los que
// contestan cuando ningún nombre casa, y sin ellos la card se queda sin foto
// justo en el caso más común: un destino que no está en la lista.
const fuente = readFileSync(join(RAIZ, "lib", "destino-imagen.ts"), "utf8");
const slugs = [...fuente.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);

describe("las fotos de destino existen en disco", () => {
  it("toda ruta que la card puede pedir apunta a un archivo real", () => {
    // Si esto falla, el regex dejó de leer los slugs y el resto del test no
    // estaría probando nada.
    expect(slugs.length).toBeGreaterThan(5);

    const necesarios = [...new Set([...slugs, "playa", "ciudad"])];
    const faltantes = necesarios.filter((s) => !existsSync(join(CARPETA, `${s}.webp`)));
    expect(
      faltantes,
      `Estos destinos se pueden elegir pero su imagen no existe — la card sale ` +
        `con un hueco: ${faltantes.join(", ")}. Corre scripts/gen-destinos.mjs.`
    ).toEqual([]);

    // El puente entre las dos mitades: que el catálogo tenga sus archivos no
    // sirve si la función arma la ruta de otra forma.
    for (const lugar of ["Cancún", "Nueva York", "un pueblo que nadie conoce"]) {
      const ruta = imagenDestino(lugar);
      expect(existsSync(join(RAIZ, "public", ruta)), `${lugar} → ${ruta}`).toBe(true);
    }
  });
});
