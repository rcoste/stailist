import type { SupabaseClient } from "@supabase/supabase-js";
import { itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";
import { loadTripContext } from "@/lib/trip-context";

// La card contextual del home (estado idle de Hoy). UNA sola, nunca dos: el
// look del día es el rey de esa pantalla y la card solo la acompaña. Si no hay
// contexto real, no hay card — el home se queda como estaba.
//
// Prioridad (la primera que aplique gana):
//   1. viaje activo o a ≤7 días  → la maleta
//   2. prenda propia sin estrenar → anclarla al look de hoy
//   3. look de ayer               → el historial
export type HomeCard =
  | {
      kind: "viaje";
      lugar: string;
      dias: number; // 0 = ya empezó
      href: string;
    }
  | {
      kind: "estrena";
      itemId: string;
      nombre: string;
      imagen: string | null;
    }
  | {
      kind: "ayer";
      outfitId: string; // para el one-tap "¿te lo pusiste?" (etapa 2 del embudo)
      nombre: string;
      worn: boolean; // "te pusiste" vs "armaste" — worn es opt-in
      href: string;
    };

const VENTANA_ESTRENA_DIAS = 14;

export async function loadHomeCard(
  supabase: SupabaseClient,
  userId: string
): Promise<HomeCard | null> {
  // ── 1. Viaje activo o próximo ────────────────────────────────────────────
  // Misma fuente que el badge del botón "Más" de la tab bar (lib/trip-context).
  const trip = await loadTripContext(supabase, userId);
  if (trip) {
    return { kind: "viaje", lugar: trip.lugar, dias: trip.dias, href: trip.href };
  }

  // ── 2. Prenda propia sin estrenar ────────────────────────────────────────
  // Solo fotos propias: señalar "estrena esto" sobre un básico de arquetipo
  // (que la usuaria solo marcó como "ya la tengo") sería inventarle una prenda.
  const desde = new Date(Date.now() - VENTANA_ESTRENA_DIAS * 86_400_000).toISOString();
  const { data: nuevas } = await supabase
    .from("items")
    .select("id, photo_path, render_status, render_path, attrs, archetypes(name, image_path)")
    .eq("user_id", userId)
    .eq("source", "photo")
    .is("deleted_at", null)
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(12);

  if (nuevas && nuevas.length > 0) {
    // "Estrenada" = apareció en un outfit que marcaste "me lo puse". worn vive
    // a nivel outfit, así que el uso por prenda se deriva del join.
    const { data: wornEvents } = await supabase
      .from("events")
      .select("outfit_id")
      .eq("user_id", userId)
      .eq("type", "worn")
      .not("outfit_id", "is", null);

    const wornOutfitIds = Array.from(
      new Set((wornEvents ?? []).map((e) => e.outfit_id as string))
    );
    const usadas = new Set<string>();
    if (wornOutfitIds.length > 0) {
      const { data: wornOutfits } = await supabase
        .from("outfits")
        .select("item_ids")
        .in("id", wornOutfitIds);
      for (const o of wornOutfits ?? []) {
        for (const id of (o.item_ids as string[]) ?? []) usadas.add(id);
      }
    }

    const sinEstrenar = nuevas.find((i) => !usadas.has(i.id as string));
    if (sinEstrenar) {
      const arch = sinEstrenar.archetypes as { name?: string } | null;
      const attrs = (sinEstrenar.attrs ?? {}) as { nombre?: string };
      // Foto propia y render viven en el bucket privado → URL firmada.
      const paths = [
        sinEstrenar.photo_path as string | null,
        sinEstrenar.render_path as string | null,
      ].filter((p): p is string => !!p);
      const signed = new Map<string, string>();
      if (paths.length > 0) {
        const { data } = await supabase.storage
          .from("prendas")
          .createSignedUrls(Array.from(new Set(paths)), 3600);
        data?.forEach((s) => {
          if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
        });
      }
      return {
        kind: "estrena",
        itemId: sinEstrenar.id as string,
        nombre: arch?.name ?? attrs.nombre ?? "esa prenda nueva",
        imagen: itemImageUrlSync(sinEstrenar as ItemImageRow, (p) => signed.get(p)),
      };
    }
  }

  // ── 3. El look de ayer ───────────────────────────────────────────────────
  const ayer = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const { data: lookAyer } = await supabase
    .from("outfits")
    .select("id, title")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("is_look_of_day", true)
    .eq("look_date", ayer)
    .maybeSingle();

  if (lookAyer) {
    const { data: worn } = await supabase
      .from("events")
      .select("id")
      .eq("user_id", userId)
      .eq("outfit_id", lookAyer.id)
      .eq("type", "worn")
      .limit(1);
    return {
      kind: "ayer",
      outfitId: lookAyer.id as string,
      nombre: (lookAyer.title as string | null) ?? "tu look",
      worn: (worn ?? []).length > 0,
      href: "/historial",
    };
  }

  return null;
}
