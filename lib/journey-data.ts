import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JourneySignals } from "@/lib/journey";

// Deriva las señales de comportamiento del motor de nudges desde datos que ya
// existen (events, outfits, items) + campos del profile. No agrega contadores
// propios: la fuente de verdad sigue siendo el evento/dato original.
export async function loadJourneySignals(
  supabase: SupabaseClient,
  profile: {
    id: string;
    avatar_path: string | null;
    capsule_target: unknown;
    gender: string | null;
    body_build: string | null;
    body_volume: string | null;
  }
): Promise<JourneySignals> {
  const userId = profile.id;

  const [likesRes, looksRes, itemsRes] = await Promise.all([
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("type", "vote_up"),
    supabase
      .from("outfits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("is_look_of_day", true),
    // Todas las prendas (incluidas borradas) para detectar personalización:
    // una foto propia (source=photo) o un básico eliminado (deleted_at).
    supabase.from("items").select("source, deleted_at").eq("user_id", userId),
  ]);

  const items = (itemsRes.data ?? []) as { source: string; deleted_at: string | null }[];
  const editedCloset = items.some((i) => i.source === "photo" || i.deleted_at != null);

  return {
    likes: likesRes.count ?? 0,
    lookDays: looksRes.count ?? 0,
    hasAvatar: !!profile.avatar_path,
    editedCloset,
    hasCapsule: profile.capsule_target != null,
    hasSilueta: !!(profile.body_build || profile.body_volume),
    siluetaApplies: profile.gender === "mujer" || profile.gender === "hombre",
  };
}
