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
import { CATALOGO } from "./proveedores/catalogo";
import { PRECIOS } from "./proveedores/precios";

// DOS listas de modelos, y son cosas distintas a propósito:
//
//   lib/models.ts        lo que CORRE en producción. Una tarea, un modelo.
//   lib/proveedores/     la BANCA: quién puede entrar a que lo midan, y a qué
//                        precio. Nombrar un modelo aquí no lo pone a correr en
//                        el producto — eso sigue siendo una línea en models.ts,
//                        y esa línea sólo se mueve cuando una medición lo gana.
//
// Por eso lib/proveedores/ queda fuera del guard. No es una excepción de
// conveniencia: es que ahí los nombres son DATOS (un catálogo y una tabla de
// precios), no una elección de qué usar escondida en un archivo suelto.
const EXENTOS = ["lib/models.ts", "lib/proveedores/"];

/** Todos los .ts/.tsx de app/ y lib/, menos los exentos y los tests. */
function fuentes(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fuentes(p, out);
    else if (
      /\.tsx?$/.test(e) &&
      !/\.test\.tsx?$/.test(e) &&
      !EXENTOS.some((x) => p.startsWith(x))
    )
      out.push(p);
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
    const deClaude = [ENGINE_MODEL, JUDGE_MODEL, CLASSIFY_MODEL, EXTRACT_MODEL, GUARD_MODEL];
    for (const m of deClaude) expect(m, m).toMatch(/^claude-(opus|sonnet|haiku)-[45]/);
    // Nada debe quedarse en la generación anterior de Opus.
    expect(deClaude.filter((m) => m.includes("opus-4"))).toEqual([]);
  });

  it("visión corre en Gemini, y eso NO es un descuido", () => {
    // Es el único que no es de Anthropic. Lo ganó midiendo: cinco fotos reales,
    // once modelos, Roberto calificando a ciegas. Empata con Opus en errores,
    // cuesta 27 veces menos y es 6 veces más rápido — y Opus fue el ÚNICO que
    // inventó una prenda, el error que nadie puede detectar desde la app.
    // Este test existe para que un futuro "se nos coló un modelo raro" no lo
    // revierta sin volver a medir: docs/decisiones/vision-2026-08-05.md.
    expect(VISION_MODEL.proveedor).toBe("gemini");
    expect(VISION_MODEL.id).toBe("gemini-3.1-flash-lite");
  });

  it("el criterio de styling corre en el modelo bueno", () => {
    // Si algún día alguien baja el motor para ahorrar, que sea una decisión y no
    // un descuido: aquí se decide si el producto sirve. Visión ya NO está aquí
    // — bajó a Gemini contra evidencia, no por ahorrar a ciegas.
    expect(ENGINE_MODEL).toContain("opus");
  });

  it("lo que corre por outfit o solo confirma, en el rápido", () => {
    expect(JUDGE_MODEL).toContain("sonnet");
    expect(CLASSIFY_MODEL).toContain("sonnet");
    expect(EXTRACT_MODEL).toContain("haiku");
    expect(GUARD_MODEL).toContain("haiku");
  });

  it("lo que corre en producción se puede medir en el comparador", () => {
    // Si el modelo de producción no está en la banca, no hay forma de retarlo
    // con otro sin tocar código — y entonces la comparación deja de existir
    // justo para la pregunta que más importa.
    const ids = new Set(CATALOGO.map((m) => m.id));
    for (const m of [ENGINE_MODEL, VISION_MODEL.id, JUDGE_MODEL]) expect(ids, m).toContain(m);
  });

  it("todo modelo de la banca tiene precio conocido", () => {
    // Un costo inventado se ve igual de creíble que uno real y decide mal. Los
    // de OpenRouter son la excepción legítima: su costo real viene en la propia
    // respuesta de la API, así que no hay nada que mantener a mano aquí.
    const sinPrecio = CATALOGO.filter(
      (m) => m.proveedor !== "openrouter" && !(m.id in PRECIOS)
    ).map((m) => m.id);
    expect(sinPrecio, `sin precio: ${sinPrecio.join(", ")}`).toEqual([]);
    // Y el de producción también, que es del que sale la factura de verdad.
    expect(VISION_MODEL.id in PRECIOS).toBe(true);
  });
});
