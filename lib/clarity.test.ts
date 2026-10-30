import { describe, expect, it } from "vitest";
import { clarityId, rutaConClarity } from "./clarity";

// Clarity entra con todo tapado o no entra. Lo que se blinda aquí es DÓNDE no
// carga y que un id con typo no termine interpolado en la URL del script.

describe("el id", () => {
  it("sin variable, no hay id", () => {
    expect(clarityId(undefined)).toBeNull();
    expect(clarityId("")).toBeNull();
  });
  it("un id con basura se descarta", () => {
    expect(clarityId("abc<script>")).toBeNull();
    expect(clarityId("https://x")).toBeNull();
  });
  it("un id normal pasa (con espacios alrededor también)", () => {
    expect(clarityId(" abcd1234ef ")).toBe("abcd1234ef");
  });
});

describe("dónde graba", () => {
  it.each(["/", "/login", "/empezar", "/onboarding/genero", "/onboarding/edad", "/privacidad", "/terminos", "/admin", "/admin/usuarios/x", "/v/abc", "/cuenta/programada"])(
    "no en %s",
    (ruta) => expect(rutaConClarity(ruta)).toBe(false)
  );
  it.each(["/hoy", "/closet", "/perfil", "/perfil/avatar", "/viaje", "/onboarding/objetivo", "/onboarding/wow", "/historial"])(
    "sí en %s",
    (ruta) => expect(rutaConClarity(ruta)).toBe(true)
  );
  it("sin ruta no graba", () => {
    expect(rutaConClarity(null)).toBe(false);
  });
});
