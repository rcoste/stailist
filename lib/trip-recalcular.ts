import type { SupabaseClient } from "@supabase/supabase-js";
import type { CapsuleItem, CapsuleOverrides, ClosetItemLite, MatchEntry } from "@/lib/capsule";
import { aplicarReglasDelCruce } from "@/lib/engine/capsule-match-reglas";

// "TU CLÓSET CAMBIÓ — RECALCULAR QUÉ TIENES", AHORA EN LA MALETA (2026-10-20).
//
// Los esenciales lo tienen desde hace meses; la maleta no. Una persona subió
// tres suéteres en la noche para que su maleta los usara, y la única forma era
// rehacer el viaje entero: la lista se volvió a sortear (el suéter rubí salió
// vino), perdió todas sus decisiones, y era la cuarta vez que lo hacía.
//
// Recalcular cruza la MISMA lista con el clóset de hoy, pero no revuelve lo
// resuelto:
//  · lo que ya estaba cubierto ("tienes" o "parecido") con una prenda suya que
//    sigue en su clóset y que no desmintió, se queda — la IA no es determinista
//    y volver a preguntarle por lo resuelto sólo mete ruido;
//  · lo demás (lo que faltaba, lo dudoso, lo que desmintió, lo que cubría una
//    prenda que ya borró) toma el cruce nuevo;
//  · y al final pasan las reglas del cruce (ni dos "tienes" con la misma
//    prenda, unos jeans son jeans, el rescate por corte).
// Donde la prenda de una pieza cambió, se limpian sus decisiones (la de
// "parecido", el duelo, la palomita de empacado): eran sobre OTRA prenda. Lo
// que eligió a mano (sub:), lo que sacó (fuera:) y lo que rechazó (rech:) se
// respeta siempre.

const mismo = (a: MatchEntry | undefined, b: MatchEntry | undefined) =>
  (a?.status ?? null) === (b?.status ?? null) && (a?.by ?? null) === (b?.by ?? null);

export function fusionarCruce(args: {
  items: CapsuleItem[];
  antes: MatchEntry[];
  nuevo: MatchEntry[];
  closet: ClosetItemLite[];
  overrides: CapsuleOverrides | null;
  empacado: Record<string, boolean> | null;
}): {
  entries: MatchEntry[];
  overrides: CapsuleOverrides;
  empacado: Record<string, boolean>;
  cambiaron: number[];
} {
  const { items, antes, nuevo, closet } = args;
  const ov = { ...((args.overrides ?? {}) as Record<string, unknown>) };
  const empacado = { ...(args.empacado ?? {}) };
  const enCloset = new Set(closet.map((c) => c.nombre));

  const fusion = items.map((_, i) => {
    const a = antes[i];
    const decision = ov[String(i)];
    // Cubierta con una prenda que sigue existiendo y que ella no desmintió: se
    // queda, aunque sea un "parecido" sin decidir. Medido en seco sobre 4
    // maletas reales: dejar que la IA re-cruzara los "parecido" bajó un bolso de
    // "parecido" a "falta" sin que nada cambiara en el clóset — puro azar. Las
    // reglas fijas sí les aplican. (Lo que faltaba sí se re-cruza, con el mismo
    // margen de error que al crear la maleta: ahí la IA cubrió una camisa de
    // popelina con una polo.)
    const resuelto =
      !!a?.by && enCloset.has(a.by) && (a.status === "tienes" || a.status === "parecido") && decision !== "reject";
    return resuelto ? a : nuevo[i] ?? { status: "falta" as const, by: null, difiere: null };
  });
  const reglas = aplicarReglasDelCruce(items, fusion, closet).entries;
  // LO QUE RECHAZÓ NO VUELVE (2026-10-21). "Ninguna de las dos me va" guarda la
  // prenda en `candRech:i` (y "no" en un parecido, `i: reject`). Recalcular no
  // lo leía: le devolvió como "tienes" unos derby que acababa de rechazar para
  // esa pieza. Si lo nuevo es una prenda que rechazó ahí, se queda lo de antes
  // con su decisión.
  const entries = reglas.map((e, i) => {
    const rech = new Set<string>(Array.isArray(ov[`candRech:${i}`]) ? (ov[`candRech:${i}`] as string[]) : []);
    if (ov[String(i)] === "reject" && antes[i]?.by) rech.add(antes[i].by!);
    return e.by && rech.has(e.by) && antes[i] ? antes[i] : e;
  });

  const cambiaron: number[] = [];
  entries.forEach((e, i) => {
    if (mismo(e, antes[i])) return;
    // Si la prenda nueva es justo la que ya eligió a mano para esta pieza, no
    // hay nada que volver a preguntar: le reabría el duelo de unos tenis que ya
    // había elegido (2026-10-21).
    if (e.by && ov[`sub:${i}`] === e.by && e.status !== "falta") {
      if (e.status === "parecido") ov[String(i)] = "accept";
      return;
    }
    cambiaron.push(i);
    delete ov[String(i)];
    delete ov[`cand:${i}`];
    delete ov[`candNo:${i}`];
    delete empacado[String(i)];
  });
  return { entries, overrides: ov as CapsuleOverrides, empacado, cambiaron };
}

/**
 * Prendas suyas que ya cambió con "no me convence" en maletas anteriores
 * (eventos trip_item_swap): el cruce las usa como último recurso. Máx 8
 * recientes. Vivía dentro de /api/trip; aquí lo comparten crear y recalcular.
 */
export async function cargarRechazadas(
  supabase: SupabaseClient,
  userId: string,
  anclas: Set<string> = new Set()
): Promise<string[]> {
  try {
    const { data: swapRows } = await supabase
      .from("events")
      .select("data")
      .eq("user_id", userId)
      .eq("type", "trip_item_swap")
      .order("created_at", { ascending: false })
      .limit(30);
    return Array.from(
      new Set(
        (swapRows ?? [])
          .map((r) => ((r.data as { from?: string } | null)?.from ?? "").trim())
          .filter((n) => n.length > 0)
          // Un ancla gana sobre un rechazo viejo: si hoy la pidió, no es rechazada.
          .filter((n) => !anclas.has(n.toLowerCase()))
      )
    ).slice(0, 8);
  } catch {
    return [];
  }
}
