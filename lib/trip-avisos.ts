import { capsuleRows, type CapsuleMatch, type CapsuleOverrides, type CapsuleTarget } from "@/lib/capsule";
import { revisarMaleta, type ClimaParada } from "@/lib/engine/trip-revision";
import { empacablesDelViaje, sustitutoDe } from "@/lib/trip-maleta";

// EL JUEZ SOBRE LO QUE DE VERDAD LLEVAS (2026-10-19).
//
// El juez de la maleta (lib/engine/trip-revision.ts) revisa la lista IDEAL al
// armarla, y ahí la lista estaba bien: traía un trench impermeable para la
// lluvia de Kioto. Pero el trench le faltaba, lo mandó a la wishlist, y lo que
// iba a llevar de verdad no aguantaba la lluvia — y nadie se lo dijo.
//
// Aquí corren las mismas reglas sobre lo que lleva (lo suyo, lo parecido y lo
// que eligió a mano; no lo que falta ni lo que sacó), dichas a ella. Si una de
// las piezas que le faltan lo resuelve, se nombra. "Que quepa" no entra: el
// tamaño ya lo cuida la maleta y aquí sólo hablamos de huecos.

export type AvisoMaleta = { regla: string; texto: string; loResuelve: string | null };

// La regla dicha a ella: el juez escribe para el motor ("la maleta no trae").
const VOZ: [RegExp, string][] = [
  [/la maleta no trae/g, "no llevas"],
  [/La maleta trae/g, "Llevas"],
  [/no hay nada que la aguante/g, "no llevas nada que la aguante"],
  [/no hay piezas ligeras para la parada calurosa/g, "no llevas nada ligero para la parada de calor"],
  [/no hay ninguna pieza formal/g, "no llevas ninguna pieza formal"],
  [/todo el calzado es abierto/g, "todo tu calzado es abierto"],
  [/El viaje incluye "trabajo o formal"/g, "Tu viaje tiene trabajo o algo formal"],
];
const enSuVoz = (detalle: string) => VOZ.reduce((t, [re, por]) => t.replace(re, por), detalle);

export function avisosDeLoQueLlevas(
  target: CapsuleTarget,
  match: CapsuleMatch | null,
  overrides: CapsuleOverrides | null,
  ctx: { paradas: ClimaParada[]; ocasiones: string[]; dias: number; contexto?: string | null; base?: number }
): AvisoMaleta[] {
  // "Trabajo o formal" es un solo chip: quien escribió que su trabajo es
  // informal no necesita que le digan que no lleva nada formal (viaje real).
  const informal = /informal/i.test(ctx.contexto ?? "");
  const lleva = empacablesDelViaje(target, match, overrides).map((p) => p.item);
  const revisar = (items: typeof lleva) =>
    revisarMaleta(items, { ...ctx, capacidad: 0 }).filter(
      (h) => h.regla !== "no-cabe" && !(informal && h.regla === "sin-formal")
    );
  // Lo que le falta y sigue en el plan (ni lo sacó ni lo sustituyó).
  const faltan = capsuleRows(target, match, overrides)
    .filter((r) => !r.dismissed && r.effective === "falta" && !sustitutoDe(overrides, r.index))
    .map((r) => r.item);
  return revisar(lleva).map((h) => {
    const pieza = faltan.find((f) => !revisar([...lleva, f]).some((x) => x.regla === h.regla));
    return { regla: h.regla, texto: enSuVoz(h.detalle), loResuelve: pieza?.nombre ?? null };
  });
}
