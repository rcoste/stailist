// CÓMO SE CUENTA UN EXAMEN DE JUEZ.
//
// Vive aparte de los scripts por la misma razón que `lib/ai-calls.ts` vive
// aparte de su pantalla: lo que no puede cambiar en silencio es la ARITMÉTICA.
// Dos exámenes que impriman tablas parecidas pero cuenten distinto producen la
// peor clase de resultado — uno que se lee como comparación y no lo es.
//
// LA CIFRA QUE MANDA es la primera columna: de los looks que Roberto reprobó,
// cuántos habría marcado el juez. La segunda (falsa alarma en los 👍) es su
// precio. Un juez que marca todo tiene 100% en la primera y no sirve para nada.
import type { CriticaStylist, Gravedad } from "@/lib/engine/juez-stylist";

export type CasoConVoto = { marca: "arriba" | "abajo" };

export const pct = (a: number, b: number) => (b ? `${Math.round((a * 100) / b)}%` : "—");

export const tiene = (c: CriticaStylist | null, niveles: Gravedad[]) =>
  !!c?.hallazgos.some((h) => niveles.includes(h.gravedad));

/** Los tres umbrales de gravedad con los que se lee cualquier juez de la casa. */
export const UMBRALES_GRAVEDAD: [string, Gravedad[]][] = [
  ["sólo 'rompe'", ["rompe"]],
  ["'rompe' o 'resta'", ["rompe", "resta"]],
  ["cualquier hallazgo", ["rompe", "resta", "detalle"]],
];

export function tabla<T extends CasoConVoto>(
  titulo: string,
  casos: T[],
  critica: (c: T) => CriticaStylist | null
) {
  const dn = casos.filter((c) => c.marca === "abajo");
  const up = casos.filter((c) => c.marca === "arriba");
  console.log(`\n${titulo} · ${casos.length} looks (${dn.length} 👎 / ${up.length} 👍)`);
  console.log(`  ${"umbral".padEnd(22)} caza de los 👎      falsa alarma en 👍`);
  for (const [etq, niveles] of UMBRALES_GRAVEDAD) {
    const caza = dn.filter((c) => tiene(critica(c), niveles)).length;
    const fa = up.filter((c) => tiene(critica(c), niveles)).length;
    console.log(
      `  ${etq.padEnd(22)} ${String(caza).padStart(3)}/${dn.length} (${pct(caza, dn.length).padStart(4)})      ${String(fa).padStart(3)}/${up.length} (${pct(fa, up.length).padStart(4)})`
    );
  }
  // De qué son los hallazgos, separando 👍 y 👎: lo que aparece mucho en 👍 es
  // severidad gastada en lo que a Roberto no le importa.
  const m: Record<string, { up: number; dn: number; rompeUp: number; rompeDn: number }> = {};
  for (const c of casos)
    for (const h of critica(c)?.hallazgos ?? []) {
      const e = (m[h.defecto] ??= { up: 0, dn: 0, rompeUp: 0, rompeDn: 0 });
      if (c.marca === "arriba") {
        e.up++;
        if (h.gravedad === "rompe") e.rompeUp++;
      } else {
        e.dn++;
        if (h.gravedad === "rompe") e.rompeDn++;
      }
    }
  console.log(`  hallazgos por defecto (en 👎 / en 👍; entre paréntesis los "rompe"):`);
  for (const [d, e] of Object.entries(m).sort((a, b) => b[1].up + b[1].dn - (a[1].up + a[1].dn)))
    console.log(
      `    ${d.padEnd(12)} 👎 ${String(e.dn).padStart(2)} (${e.rompeDn})   👍 ${String(e.up).padStart(2)} (${e.rompeUp})`
    );
}
