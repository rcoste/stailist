import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TABLAS_EN_CASCADA, TABLAS_SIN_CASCADA, listarCarpeta, type ListaStorage } from "./borrar-cuenta";

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

  it("una carpeta que no existe devuelve vacío, no lanza", async () => {
    expect(await listarCarpeta(bucketFalso({}), "nadie")).toEqual([]);
  });
});
