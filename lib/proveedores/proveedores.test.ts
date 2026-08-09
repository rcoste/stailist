import { describe, it, expect } from "vitest";
import { esReintentable } from "./index";

// EL REINTENTO DE LA PUERTA COMÚN.
//
// Cazado en QA del espejo: Gemini devolvió 503 "Unable to process input image"
// sobre una foto perfectamente sana, la lectura de prendas murió, y el
// reintento manual funcionó a la primera. O sea que la persona vio un error que
// no existía. El generador de imágenes ya reintentaba; los tres caminos que
// LEEN fotos, no.
describe("esReintentable — qué merece una segunda oportunidad", () => {
  const casos: [string, boolean][] = [
    ["gemini: 503 UNAVAILABLE Unable to process input image", true],
    ["gemini: 429 rate limit", true],
    ["anthropic: 529 overloaded_error", true],
    ["fetch failed", true],
    ["ECONNRESET", true],
    // Un 400 es la petición, no el servidor: reintentar lo mal escrito sólo
    // cuesta tiempo y dinero.
    ["gemini: 400 invalid image media type", false],
    ["anthropic: 401 authentication_error", false],
    ["falta GOOGLE_GENERATIVE_AI_API_KEY", false],
  ];
  for (const [mensaje, esperado] of casos) {
    it(`${esperado ? "reintenta" : "NO reintenta"}: ${mensaje.slice(0, 42)}`, () => {
      expect(esReintentable(new Error(mensaje))).toBe(esperado);
    });
  }
});
