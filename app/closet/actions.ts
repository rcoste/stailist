"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PrendaAnalisis } from "@/app/api/analizar-prenda/route";

// Guarda una prenda fotografiada por la usuaria. La foto ya está en el bucket
// privado 'prendas' (la subió el cliente con su RLS). attrs lleva los atributos
// confirmados/editados — entran al motor igual que los de un arquetipo.
export async function addPhotoItem(
  photoPath: string,
  attrs: PrendaAnalisis
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // photoPath debe estar dentro de la carpeta del usuario (defensa extra
  // además de la RLS del Storage).
  if (!photoPath.startsWith(`${user.id}/`)) return { ok: false };

  const { error } = await supabase.from("items").insert({
    user_id: user.id,
    source: "photo",
    photo_path: photoPath,
    attrs: {
      nombre: attrs.nombre,
      categoria: attrs.categoria,
      color: attrs.color,
      color_hex: attrs.color_hex,
      formalidad: attrs.formalidad,
      temporada: attrs.temporada,
    },
  });
  if (error) return { ok: false };

  revalidatePath("/closet");
  return { ok: true };
}

// Quita una prenda del clóset (soft delete — deja rastro para señales del
// journey). Sirve para podar básicos asumidos que la usuaria no tiene. Verifica
// propiedad por user_id además de la RLS.
export async function removeItem(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null);
  if (error) return { ok: false };

  revalidatePath("/closet");
  return { ok: true };
}

// Edita los atributos de una prenda FOTOGRAFIADA (corrige lo que la IA leyó mal).
// Solo aplica a source='photo': los arquetipos derivan su display del catálogo,
// así que editarlos no tendría efecto (se podan, no se editan).
export async function updateItemAttrs(
  id: string,
  patch: {
    nombre?: string;
    categoria?: string;
    formalidad?: string;
    temporada?: string;
  }
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: item } = await supabase
    .from("items")
    .select("attrs, source")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();
  if (!item || item.source !== "photo") return { ok: false };

  const attrs = (item.attrs ?? {}) as Record<string, unknown>;
  const clean: Record<string, unknown> = { ...attrs };
  if (typeof patch.nombre === "string" && patch.nombre.trim())
    clean.nombre = patch.nombre.trim().slice(0, 60);
  if (patch.categoria) clean.categoria = patch.categoria;
  if (patch.formalidad) clean.formalidad = patch.formalidad;
  if (patch.temporada) clean.temporada = patch.temporada;

  const { error } = await supabase
    .from("items")
    .update({ attrs: clean })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false };

  revalidatePath("/closet");
  return { ok: true };
}

// Agrega básicos del catálogo (arquetipos) al clóset DESPUÉS del onboarding —
// la "biblioteca completa". A diferencia de saveCloset (onboarding), no avanza
// pasos ni exige mínimo; valida contra el catálogo, respeta el género y no
// reinserta lo que ya tiene.
export async function addArchetypes(
  archetypeIds: number[]
): Promise<{ ok: boolean; added: number }> {
  const ids = [...new Set(archetypeIds)].filter(
    (id) => Number.isInteger(id) && id > 0
  );
  if (ids.length === 0) return { ok: false, added: 0 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, added: 0 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("gender")
    .eq("id", user.id)
    .single();
  const gender = profile?.gender ?? "hombre";

  const { data: archetypes } = await supabase
    .from("archetypes")
    .select("id, name, attrs, image_path, segment")
    .in("id", ids);
  if (!archetypes || archetypes.length === 0) return { ok: false, added: 0 };

  // Solo del género del usuario o unisex (defensa contra IDs manipulados).
  const allowed = archetypes.filter(
    (a) => a.segment === "unisex" || a.segment === gender
  );

  // No reinsertar lo que ya tiene.
  const { data: existing } = await supabase
    .from("items")
    .select("archetype_id")
    .eq("user_id", user.id)
    .is("deleted_at", null);
  const have = new Set((existing ?? []).map((e) => e.archetype_id));
  const toInsert = allowed.filter((a) => !have.has(a.id));
  if (toInsert.length === 0) return { ok: true, added: 0 };

  const { error } = await supabase.from("items").insert(
    toInsert.map((a) => ({
      user_id: user.id,
      source: "archetype",
      archetype_id: a.id,
      attrs: {
        nombre: a.name,
        image_path: a.image_path,
        ...(a.attrs as Record<string, unknown>),
      },
    }))
  );
  if (error) return { ok: false, added: 0 };

  revalidatePath("/closet");
  return { ok: true, added: toInsert.length };
}
