import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// EL CANDADO DE LA LLAVE MAESTRA (lib/supabase/servicio.ts).
//
// La llave de servicio se salta toda la RLS. Entró a la app el 2026-09-10 sólo
// para que la limpieza diaria pueda borrar las fotos de una cuenta cuyo
// borrado programado venció. Si mañana alguien la importa en una ruta que
// responde a una persona, cualquier bug de esa ruta se vuelve un acceso a los
// datos de todos. Este test lo impide antes de que llegue a producción.

const RAIZ = join(import.meta.dirname, "..");
const PERMITIDOS_IMPORTAR = new Set(["app/api/cron/limpieza/route.ts"]);
const DUENO_DE_LA_VARIABLE = "lib/supabase/servicio.ts";

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(dir)) {
    if (nombre === "node_modules" || nombre.startsWith(".")) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) out.push(...archivos(ruta));
    else if (/\.(ts|tsx)$/.test(nombre) && !/\.test\.(ts|tsx)$/.test(nombre)) out.push(ruta);
  }
  return out;
}

const fuentes = ["app", "lib", "components"]
  .flatMap((d) => archivos(join(RAIZ, d)))
  .concat([join(RAIZ, "proxy.ts")])
  .map((ruta) => ({ rel: relative(RAIZ, ruta), texto: readFileSync(ruta, "utf8") }));

describe("la llave de servicio vive encerrada", () => {
  it("sólo lib/supabase/servicio.ts lee SUPABASE_SERVICE_ROLE_KEY", () => {
    const lectores = fuentes.filter((f) => f.texto.includes("SUPABASE_SERVICE_ROLE_KEY")).map((f) => f.rel);
    expect(lectores).toEqual([DUENO_DE_LA_VARIABLE]);
  });

  it("sólo la limpieza diaria importa el cliente de servicio", () => {
    const importadores = fuentes
      .filter((f) => /from ["']@\/lib\/supabase\/servicio["']/.test(f.texto))
      .map((f) => f.rel);
    expect(importadores.every((r) => PERMITIDOS_IMPORTAR.has(r)), importadores.join(", ")).toBe(true);
    expect(importadores).toContain("app/api/cron/limpieza/route.ts");
  });

  it("ningún archivo de cliente la toca", () => {
    const cliente = fuentes.filter((f) => /^["']use client["']/m.test(f.texto));
    for (const f of cliente) {
      expect(f.texto, f.rel).not.toMatch(/supabase\/servicio|SERVICE_ROLE/);
    }
  });
});
