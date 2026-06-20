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

// Importar del carrete: inserta en lote las prendas que el usuario CONFIRMÓ
// (texto + render visual). Se llama una sola vez al final del flujo, así las
// prendas no aparecen/desaparecen del clóset mientras se curan. `renderPath` ya
// viene del render de Gemini; si el render falló, renderStatus='failed' y el
// clóset cae al swatch de color. Spec: docs/designs/import-carrete-multiprenda.md
export async function addPhotoItems(
  items: {
    attrs: PrendaAnalisis;
    renderPath: string | null;
    renderStatus: "done" | "failed";
  }[]
): Promise<{ ok: boolean; added: number }> {
  const clean = items.slice(0, 30); // tope de seguridad por lote
  if (clean.length === 0) return { ok: true, added: 0 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, added: 0 };

  // render_path debe estar dentro de la carpeta del usuario (defensa además de RLS).
  for (const it of clean) {
    if (it.renderPath && !it.renderPath.startsWith(`${user.id}/`)) {
      return { ok: false, added: 0 };
    }
  }

  const { error } = await supabase.from("items").insert(
    clean.map((it) => ({
      user_id: user.id,
      source: "photo",
      attrs: {
        nombre: it.attrs.nombre,
        categoria: it.attrs.categoria,
        color: it.attrs.color,
        color_hex: it.attrs.color_hex,
        formalidad: it.attrs.formalidad,
        temporada: it.attrs.temporada,
      },
      render_status: it.renderStatus,
      render_path: it.renderPath,
    }))
  );
  if (error) return { ok: false, added: 0 };

  revalidatePath("/closet");
  return { ok: true, added: clean.length };
}

// Render rechazado en la confirmación visual ("no es mi prenda" pero la imagen
// es válida): no se borra, va a staging para que el admin decida si entra a la
// biblioteca compartida. Nunca se publica solo.
export async function addLibraryCandidates(
  candidates: { attrs: PrendaAnalisis; imagePath: string }[]
): Promise<{ ok: boolean; added: number }> {
  const clean = candidates.slice(0, 30);
  if (clean.length === 0) return { ok: true, added: 0 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, added: 0 };

  for (const c of clean) {
    if (!c.imagePath.startsWith(`${user.id}/`)) return { ok: false, added: 0 };
  }

  const { error } = await supabase.from("library_candidates").insert(
    clean.map((c) => ({
      user_id: user.id,
      attrs: {
        nombre: c.attrs.nombre,
        categoria: c.attrs.categoria,
        color: c.attrs.color,
        color_hex: c.attrs.color_hex,
        formalidad: c.attrs.formalidad,
        temporada: c.attrs.temporada,
      },
      image_path: c.imagePath,
      source_kind: "rejected_render",
    }))
  );
  if (error) return { ok: false, added: 0 };

  return { ok: true, added: clean.length };
}
