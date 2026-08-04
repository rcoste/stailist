import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ENGINE_MODEL,
  VISION_MODEL,
  JUDGE_MODEL,
  CLASSIFY_MODEL,
  EXTRACT_MODEL,
  GUARD_MODEL,
} from "./models";

/** Todos los .ts/.tsx de app/ y lib/, menos el propio models.ts y los tests. */
function fuentes(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fuentes(p, out);
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e) && p !== "lib/models.ts") out.push(p);
  }
  return out;
}

describe("los modelos viven en un solo lugar", () => {
  it("ningún archivo escribe el nombre de un modelo a mano", () => {
    // Estaban hardcodeados en 14 archivos. Al actualizar de generación siempre
    // se quedaba alguno atrás, corriendo en silencio con un modelo viejo: no
    // truena nada, solo empeora. Este test es lo que impide que vuelva a pasar.
    const culpables = [...fuentes("app"), ...fuentes("lib")].filter((f) =>
      /["']claude-[a-z0-9.-]+["']/.test(readFileSync(f, "utf8"))
    );
    expect(culpables, `escriben un modelo a mano: ${culpables.join(", ")}`).toEqual([]);
  });

  it("cada tarea apunta a un modelo real y de la generación vigente", () => {
    // Los ids sueltos se equivocan callados: un nombre inválido no truena hasta
    // que alguien usa esa pantalla en producción.
    const todos = [ENGINE_MODEL, VISION_MODEL, JUDGE_MODEL, CLASSIFY_MODEL, EXTRACT_MODEL, GUARD_MODEL];
    for (const m of todos) expect(m, m).toMatch(/^claude-(opus|sonnet|haiku)-[45]/);
    // Nada debe quedarse en la generación anterior de Opus.
    expect(todos.filter((m) => m.includes("opus-4"))).toEqual([]);
  });

  it("el criterio de styling corre en el modelo bueno", () => {
    // Si algún día alguien baja el motor para ahorrar, que sea una decisión y no
    // un descuido: aquí se decide si el producto sirve.
    expect(ENGINE_MODEL).toContain("opus");
    expect(VISION_MODEL).toContain("opus");
  });

  it("lo que corre por outfit o solo confirma, en el rápido", () => {
    expect(JUDGE_MODEL).toContain("sonnet");
    expect(CLASSIFY_MODEL).toContain("sonnet");
    expect(EXTRACT_MODEL).toContain("haiku");
    expect(GUARD_MODEL).toContain("haiku");
  });
});
