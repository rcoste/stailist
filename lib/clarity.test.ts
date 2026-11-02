import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { clarityId, conFotosTapadas, rutaConClarity } from "./clarity";

// Clarity entra sin una sola foto o no entra. Lo que se blinda aquí es DÓNDE no
// carga, que un id con typo no termine en la URL del script y que ninguna foto
// llegue por un camino que Clarity no limpia.

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

describe("las fotos se tapan desde el código, no desde el panel", () => {
  it("agrega las fotos al arranque aunque el panel no mande nada", () => {
    const [, config] = conFotosTapadas(["start", { projectId: "abc123", upload: "x" }]) as [string, { mask: string[]; projectId: string }];
    expect(config.mask).toEqual(expect.arrayContaining(["img", "video", "source"]));
    expect(config.projectId).toBe("abc123");
  });

  it("conserva lo que venga del panel y no repite", () => {
    const [, config] = conFotosTapadas(["start", { mask: ["img", ".privado"] }]) as [string, { mask: string[] }];
    expect(config.mask).toContain(".privado");
    expect(config.mask.filter((x) => x === "img")).toHaveLength(1);
  });

  it("no toca las demás llamadas", () => {
    expect(conFotosTapadas(["set", "app_instalada", "si"])).toEqual(["set", "app_instalada", "si"]);
    expect(conFotosTapadas(["start"])).toEqual(["start"]);
  });
});

// Clarity sólo limpia src, srcset, title, alt y href. Lo demás sale tal cual,
// así que estos dos caminos le entregarían el enlace firmado de una foto privada.
describe("ninguna foto llega a Clarity por un camino que no limpia", () => {
  const archivos = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const ruta = join(dir, e.name);
      if (e.isDirectory()) return ruta === join("app", "admin") ? [] : archivos(ruta);
      return e.name.endsWith(".tsx") && !e.name.includes(".test.") ? [ruta] : [];
    });
  const fuentes = [...archivos("app"), ...archivos("components")].map((ruta) => ({
    ruta,
    texto: readFileSync(ruta, "utf8"),
  }));

  it("ninguna imagen variable se pinta como fondo CSS", () => {
    const culpables = fuentes.filter((f) => /url\(\$\{/.test(f.texto)).map((f) => f.ruta);
    expect(culpables).toEqual([]);
  });

  it("`priority` de una prenda sólo aplica a imágenes públicas", () => {
    const grid = fuentes.find((f) => f.ruta.endsWith("closet-grid.tsx"))!;
    expect(grid.texto).toContain('priority={priority && item.imagen.startsWith("/")}');
  });
});
