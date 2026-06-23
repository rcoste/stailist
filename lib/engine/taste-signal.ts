import type { SupabaseClient } from "@supabase/supabase-js";

// "La app aprende" (paso 9 del journey): convierte el feedback REAL de la persona
// (qué se puso, qué votó 👍/👎, de qué pidió otro) en contexto para el motor.
// El modelo generaliza el PATRÓN (colores, formalidad, siluetas) — no copia looks.
// Mismo mecanismo que recentCombos, pero con la señal de gusto en vez de solo
// anti-repetición. Con cero feedback, sale vacío y no estorba.

// Un look recordado: cómo se lo presentamos al modelo.
export type RememberedOutfit = {
  title: string | null;
  items: string[]; // nombres de las prendas que aún existen en el clóset
  occasion: string | null;
  reason: string | null; // lo que la persona escribió (en 👎 y "otro look")
};

export type TasteSignal = {
  worn: RememberedOutfit[]; // se lo puso de verdad — la señal más fuerte
  liked: RememberedOutfit[]; // 👍
  disliked: RememberedOutfit[]; // 👎 (idealmente con razón)
  skipped: RememberedOutfit[]; // pidió otro, solo si dejó una razón
};

export const EMPTY_TASTE_SIGNAL: TasteSignal = {
  worn: [],
  liked: [],
  disliked: [],
  skipped: [],
};

export function hasTasteSignal(s: TasteSignal): boolean {
  return (
    s.worn.length > 0 ||
    s.liked.length > 0 ||
    s.disliked.length > 0 ||
    s.skipped.length > 0
  );
}

// Ventana y topes: acotan tokens y ruido. Priorizamos lo reciente y, en los
// negativos, lo que trae razón escrita (ahí está el oro del feedback).
const WINDOW_DAYS = 60;
const EVENT_FETCH_LIMIT = 60;
const CAP = { worn: 6, liked: 6, disliked: 6, skipped: 4 };

// Prioridad al deduplicar: un mismo outfit puede tener varios eventos; gana el
// más fuerte (se lo puso > le gustó > lo rechazó > pidió otro).
const PRIORITY: Record<string, number> = {
  worn: 4,
  vote_up: 3,
  vote_down: 2,
  another_look: 1,
};

type EventRow = {
  type: string;
  data: { reason?: string } | null;
  remembered:
    | {
        id: string;
        item_ids: string[] | null;
        title: string | null;
        occasion: string | null;
      }
    | { id: string; item_ids: string[] | null; title: string | null; occasion: string | null }[]
    | null;
};

// Lee el feedback reciente y lo arma en señal estructurada. Self-contained:
// resuelve los nombres de prenda por su cuenta (no depende del clóset ya
// filtrado del caller, para nombrar también prendas vetadas que sí se usaron).
export async function loadTasteSignal(
  supabase: SupabaseClient,
  userId: string
): Promise<TasteSignal> {
  const since = new Date(
    Date.now() - WINDOW_DAYS * 24 * 3600 * 1000
  ).toISOString();

  const { data: rows } = await supabase
    .from("events")
    .select("type, data, remembered:outfits(id, item_ids, title, occasion)")
    .eq("user_id", userId)
    .in("type", ["worn", "vote_up", "vote_down", "another_look"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(EVENT_FETCH_LIMIT);

  if (!rows || rows.length === 0) return EMPTY_TASTE_SIGNAL;

  // Dedup por outfit: nos quedamos con el evento de mayor prioridad por outfit,
  // conservando la razón si el evento la trae. El orden desc preserva recencia.
  type Pick = {
    type: string;
    reason: string | null;
    outfit: { item_ids: string[] | null; title: string | null; occasion: string | null };
  };
  const byOutfit = new Map<string, Pick>();
  const order: string[] = []; // ids en orden de aparición (recencia)

  for (const r of rows as EventRow[]) {
    const o = Array.isArray(r.remembered) ? r.remembered[0] : r.remembered;
    if (!o || !o.id) continue;
    const reason =
      typeof r.data?.reason === "string" && r.data.reason.trim()
        ? r.data.reason.trim().slice(0, 120)
        : null;
    const prev = byOutfit.get(o.id);
    if (!prev) {
      order.push(o.id);
      byOutfit.set(o.id, { type: r.type, reason, outfit: o });
    } else if ((PRIORITY[r.type] ?? 0) > (PRIORITY[prev.type] ?? 0)) {
      // Gana el evento más fuerte, pero no perdemos una razón ya capturada.
      byOutfit.set(o.id, {
        type: r.type,
        reason: prev.reason ?? reason,
        outfit: o,
      });
    } else if (!prev.reason && reason) {
      prev.reason = reason;
    }
  }

  // Resuelve nombres de prenda de todos los item_ids vistos.
  const allIds = new Set<string>();
  for (const id of order) {
    for (const iid of byOutfit.get(id)!.outfit.item_ids ?? []) allIds.add(iid);
  }
  const nameById = new Map<string, string>();
  if (allIds.size > 0) {
    const { data: items } = await supabase
      .from("items")
      .select("id, attrs")
      .in("id", [...allIds]);
    for (const it of items ?? []) {
      const nombre = (it.attrs as { nombre?: string } | null)?.nombre;
      if (nombre) nameById.set(it.id as string, nombre);
    }
  }

  const toRemembered = (p: Pick): RememberedOutfit => ({
    title: p.outfit.title,
    items: (p.outfit.item_ids ?? [])
      .map((iid) => nameById.get(iid))
      .filter((n): n is string => !!n),
    occasion: p.outfit.occasion,
    reason: p.reason,
  });

  const out: TasteSignal = {
    worn: [],
    liked: [],
    disliked: [],
    skipped: [],
  };
  for (const id of order) {
    const p = byOutfit.get(id)!;
    const r = toRemembered(p);
    // Descarta recuerdos vacíos (todas las prendas borradas y sin título).
    if (r.items.length === 0 && !r.title) continue;
    if (p.type === "worn") out.worn.push(r);
    else if (p.type === "vote_up") out.liked.push(r);
    else if (p.type === "vote_down") out.disliked.push(r);
    else if (p.type === "another_look" && r.reason) out.skipped.push(r); // sin razón = ruido
  }

  out.worn = out.worn.slice(0, CAP.worn);
  out.liked = out.liked.slice(0, CAP.liked);
  out.disliked = out.disliked.slice(0, CAP.disliked);
  out.skipped = out.skipped.slice(0, CAP.skipped);
  return out;
}
