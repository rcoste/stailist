import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// CONTRATO: lo que la primera pantalla del onboarding escribe en el perfil
// tiene que sobrevivir a la adopción del borrador. La primera pantalla corre
// casi siempre ANTES del correo, o sea en el perfil anónimo; si una columna no
// se copia al adoptar, se pierde en silencio (pasó con país y aparato el
// 2026-10-06, el mismo día que nacieron).

const raiz = join(import.meta.dirname, "..");
const genero = readFileSync(join(raiz, "app/onboarding/genero/page.tsx"), "utf8");
const adoptar = readFileSync(join(raiz, "lib/borrador-adoptar.ts"), "utf8");

describe("adoptar el borrador", () => {
  it("copia todo lo que la primera pantalla escribe en el perfil", () => {
    const update = genero.slice(genero.indexOf(".update({"), genero.indexOf(".eq(\"id\", profile.id)"));
    const columnas = [...update.matchAll(/\b([a-z_]+):/g)].map((m) => m[1]);
    expect(columnas).toEqual(expect.arrayContaining(["onboarding_started_at", "pais", "region"]));
    for (const col of [...columnas, "dispositivo"]) expect(adoptar).toMatch(new RegExp(`\\b${col}\\b`));
  });
});
