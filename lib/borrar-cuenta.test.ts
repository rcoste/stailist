import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TABLAS_EN_CASCADA, TABLAS_SIN_CASCADA, listarCarpeta, rutasPropias, type ListaStorage } from "./borrar-cuenta";

// El script de reset (terminal) y el borrado de cuenta (app) tienen que
// conocer las MISMAS tablas. Si alguien agrega una tabla con user_id y la
// suma sólo a uno de los dos, el otro deja huérfanos sin que nadie lo note.
describe("borrar cuenta y reset-usuario conocen las mismas tablas", () => {
  const reset = readFileSync(join(process.cwd(), "scripts/reset-usuario.ts"), "utf8");

  it("cada tabla que borra el reset está declarada aquí", () => {
    const m = reset.match(/for \(const t of \[([^\]]+)\]\)/);
    expect(m).not.toBeNull();
    const delReset = m![1].match(/"([a-z_]+)"/g)!.map((s) => s.replace(/"/g, ""));
    const aqui = new Set<string>([...TABLAS_EN_CASCADA, ...TABLAS_SIN_CASCADA]);
    for (const t of delReset) expect(aqui.has(t), `falta ${t} en lib/borrar-cuenta`).toBe(true);
  });

  it("ai_calls no cascadea desde profiles y por eso va explícita", () => {
    expect(TABLAS_SIN_CASCADA).toContain("ai_calls");
    expect(TABLAS_SIN_CASCADA).toContain("wishlist_items");
  });
});

// Un bucket de mentira con carpetas anidadas y paginación de 100.
function bucketFalso(arbol: Record<string, string[]>): ListaStorage {
  return {
    async list(carpeta, { limit, offset }) {
      const hijos = arbol[carpeta] ?? [];
      const pagina = hijos.slice(offset, offset + limit).map((n) => ({
        name: n,
        id: arbol[`${carpeta}/${n}`] ? null : "archivo",
      }));
      return { data: pagina, error: null };
    },
  };
}

describe("rutasPropias: la llave de servicio sólo borra lo de la dueña", () => {
  const UID = "c815fe5a-1111-4222-8333-944455556666";

  it("deja pasar lo que vive bajo la carpeta de la persona", () => {
    expect(rutasPropias(UID, [`${UID}/items/a.jpg`, `${UID}/style-ref/b.png`])).toEqual([
      `${UID}/items/a.jpg`,
      `${UID}/style-ref/b.png`,
    ]);
  });

  it("descarta rutas ajenas: catálogo, presets, otra persona, prefijo parecido", () => {
    const otra = "7a6a2796-1111-4222-8333-944455556666";
    expect(
      rutasPropias(UID, [
        "catalog/camisa.jpg",
        "presets/minimal.png",
        `${otra}/items/a.jpg`,
        `${UID}-copia/items/a.jpg`,
        UID,
      ])
    ).toEqual([]);
  });

  it("descarta rutas que intentan salirse con ..", () => {
    expect(rutasPropias(UID, [`${UID}/../${"7a6a2796-1111-4222-8333-944455556666"}/a.jpg`])).toEqual([]);
  });

  it("lanza con un uid que no es uuid: vacío sería la raíz del bucket", () => {
    expect(() => rutasPropias("", [])).toThrow(/uid inválido/);
    expect(() => rutasPropias("catalog", ["catalog/a.jpg"])).toThrow(/uid inválido/);
  });
});

describe("listarCarpeta: la carpeta es el inventario, no las filas", () => {
  it("entra en subcarpetas (tryons, style-ref, comparador/…)", async () => {
    const b = bucketFalso({
      u1: ["avatar.jpg", "tryons", "style-ref", "comparador"],
      "u1/tryons": ["a.jpg", "b.jpg"],
      "u1/style-ref": ["r.png"],
      "u1/comparador": ["c1"],
      "u1/comparador/c1": ["1.jpeg"],
    });
    const r = await listarCarpeta(b, "u1");
    expect(r.sort()).toEqual([
      "u1/avatar.jpg",
      "u1/comparador/c1/1.jpeg",
      "u1/style-ref/r.png",
      "u1/tryons/a.jpg",
      "u1/tryons/b.jpg",
    ]);
  });

  it("pagina de 100 en 100 sin perder el último", async () => {
    const muchos = Array.from({ length: 250 }, (_, i) => `f${i}.jpg`);
    const r = await listarCarpeta(bucketFalso({ u1: muchos }), "u1");
    expect(r).toHaveLength(250);
    expect(r).toContain("u1/f249.jpg");
  });

  it("estricto: un error en una subcarpeta lanza, no se lee como vacío", async () => {
    const bucket: ListaStorage = {
      list: async (carpeta) =>
        carpeta === "u"
          ? { data: [{ name: "tryons", id: null }, { name: "a.jpg", id: "1" }], error: null }
          : { data: null, error: { message: "timeout" } },
    };
    // Sin estricto se traga el error (así borra lo que puede)...
    expect(await listarCarpeta(bucket, "u")).toEqual(["u/a.jpg"]);
    // ...pero para verificar que no quedó nada, un error es un error.
    await expect(listarCarpeta(bucket, "u", { estricto: true })).rejects.toThrow(/u\/tryons: timeout/);
  });

  it("una carpeta que no existe devuelve vacío, no lanza", async () => {
    expect(await listarCarpeta(bucketFalso({}), "nadie")).toEqual([]);
  });
});
