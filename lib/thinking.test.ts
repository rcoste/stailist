import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// TODA llamada a Claude apaga el thinking. El guard existe por un incidente
// concreto, no por gusto.
//
// QUÉ PASÓ (2026-08-06)
// La pantalla de esenciales le quedó muerta a Pablo: "No pude calcular —
// reintentar", para siempre. La causa no fue el prompt ni sus prendas: el
// 2026-08-04 se centralizaron los modelos y esa llamada pasó de
// `claude-opus-4-8` (familia 4, thinking OFF) a un modelo 5, donde el thinking
// adaptativo viene ENCENDIDO por default. El thinking se comió los 4096 tokens
// de salida, la respuesta llegó SIN bloque de texto, y el `catch` del caller lo
// convirtió en un botón de reintentar que nunca iba a funcionar.
//
// Al revisarlo aparecieron ONCE llamadas más con el mismo hueco. Ninguna
// tronaba todavía: cada una es una bomba esperando una entrada lo bastante
// grande. Ese es justo el tipo de deuda que un test caza y una revisión no.
//
// Medido en el caso que explotó: thinking ON = 2.963 tokens de salida y 21.8s;
// OFF = 1.284 y 10.4s. No compra calidad — las reglas ya están en el system, y
// los schemas del motor obligan a razonar en un campo antes de comprometer la
// respuesta.
//
// SI ALGUNA TAREA LLEGARA A QUERER THINKING: se enciende a propósito, con su
// max_tokens subido para que quepan las dos cosas, y se agrega aquí abajo con
// la razón. Lo que este test prohíbe es heredarlo sin decidirlo.

/** Fuentes de producción: app/ y lib/, sin tests. */
function fuentes(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fuentes(p, out);
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

/**
 * Cuenta llamadas y apagados por archivo. Es un chequeo de texto a propósito:
 * un análisis de AST sería más fino, pero esto falla ruidosamente y se entiende
 * de un vistazo, que es lo que importa en un guard.
 */
function contar(txt: string): { llamadas: number; apagados: number } {
  return {
    llamadas: (txt.match(/messages\.create\(/g) ?? []).length,
    apagados: (txt.match(/thinking:\s*\{\s*type:\s*"disabled"\s*\}/g) ?? []).length,
  };
}

describe("thinking apagado en todas las llamadas a Claude", () => {
  const archivos = [...fuentes("app"), ...fuentes("lib")];

  it("cada messages.create de app/ y lib/ apaga el thinking", () => {
    const huecos: string[] = [];
    for (const f of archivos) {
      const { llamadas, apagados } = contar(readFileSync(f, "utf8"));
      if (llamadas > 0 && apagados < llamadas) {
        huecos.push(`${f} — ${llamadas} llamada(s), ${apagados} apagado(s)`);
      }
    }
    expect(huecos, `Llamadas a Claude sin thinking apagado:\n${huecos.join("\n")}`).toEqual([]);
  });

  it("la puerta común lo apaga (es por donde debería pasar todo)", () => {
    const { llamadas, apagados } = contar(readFileSync("lib/proveedores/index.ts", "utf8"));
    expect(llamadas).toBeGreaterThan(0);
    expect(apagados).toBe(llamadas);
  });

  it("el match de la cápsula lo apaga — es el que explotó", () => {
    const txt = readFileSync("lib/engine/capsule-match.ts", "utf8");
    expect(txt).toContain('thinking: { type: "disabled" }');
  });
});

// La MISMA idea, del otro lado: la generación de imágenes también tuvo cuatro
// copias del mismo fetch a Gemini, y las copias se quedaron sin el reintento y
// el timeout que la primera sí recibió. El avatar quedó sin reintento un mes;
// el render de prenda marcaba "failed" ante un 500 pasajero.
describe("las imágenes salen por una sola puerta", () => {
  it("nadie llama a generateContent de Gemini fuera de lib/gemini-imagen.ts", () => {
    const fuera: string[] = [];
    for (const f of [...fuentes("app"), ...fuentes("lib")]) {
      if (f === "lib/gemini-imagen.ts") continue;
      const txt = readFileSync(f, "utf8");
      // Solo la generación de IMÁGENES: la de texto va por lib/proveedores.
      if (/generativelanguage\.googleapis\.com/.test(txt) && /responseModalities/.test(txt)) {
        fuera.push(f);
      }
    }
    expect(
      fuera,
      `Generan imágenes con su propio fetch (se pierden el reintento y el timeout):\n${fuera.join("\n")}`
    ).toEqual([]);
  });
});
