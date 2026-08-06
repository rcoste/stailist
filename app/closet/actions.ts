"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { borrowArchetypeImage } from "@/lib/capsule-data";
import {
  cleanPatron,
  cleanTextAttr,
  MAX_COLOR_LEN,
  MAX_MATERIAL_LEN,
} from "@/lib/prenda-atributos";
import type { PrendaAnalisis } from "@/app/api/analizar-prenda/route";

// Frontera de confianza LLM→DB: los campos de texto libre del análisis de
// visión se normalizan/validan server-side antes de persistir (las server
// actions son endpoints públicos para usuarios autenticados — un cliente
// manipulado no debe poder meter strings arbitrarios que luego entran a los
// prompts del motor). patron se valida contra el vocabulario cerrado.
// Vocabulario CERRADO: cualquier otra cosa se descarta (ausente = ropa de calle,
// que es el caso normal). Igual que patron, no se acepta texto libre — de aquí
// sale una decisión del match, no una etiqueta decorativa.
const CONTEXTOS_VALIDOS = ["bano", "dormir", "interior", "gym"] as const;
function cleanContexto(v: unknown): string | undefined {
  return typeof v === "string" &&
    (CONTEXTOS_VALIDOS as readonly string[]).includes(v)
    ? v
    : undefined;
}

function cleanAtributosRicos(attrs: PrendaAnalisis) {
  return {
    material: cleanTextAttr(attrs.material, MAX_MATERIAL_LEN),
    // El tipo fino: derby/oxford, cruzado/sencillo, con pinzas. Corto a
    // propósito — es una etiqueta, no una descripción, y el motor la lee pegada
    // al nombre. Si el modelo se explaya, se recorta en vez de descartarse.
    subtipo: cleanTextAttr(attrs.subtipo, MAX_MATERIAL_LEN),
    patron: cleanPatron(attrs.patron),
    color_secundario: cleanTextAttr(attrs.color_secundario, MAX_COLOR_LEN),
    contexto: cleanContexto(attrs.contexto),
  };
}

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
      largo: attrs.largo,
      corte: attrs.corte,
      manga: attrs.manga,
      ...cleanAtributosRicos(attrs),
    },
  });
  if (error) return { ok: false };

  revalidatePath("/closet");
  return { ok: true };
}

// Backfill: a las prendas que agregaste con "ya la tengo" ANTES de que el préstamo
// de imagen existiera (sin foto, sin arquetipo, sin image_path) les presta ahora el
// flat-lay de un arquetipo de su misma categoría y color, para que no salgan como
// un bloque de color. Idempotente: re-correrlo no toca lo que ya tiene imagen.
// Opera solo sobre las prendas propias (RLS); el botón vive gateado a admin.
export async function backfillBorrowedImages(): Promise<{ ok: boolean; updated: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, updated: 0 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("gender")
    .eq("id", user.id)
    .single();
  const gender = (profile?.gender as "hombre" | "mujer" | null) ?? null;

  // Candidatas: sin arquetipo y sin foto propia (las de "ya la tengo").
  const { data: items } = await supabase
    .from("items")
    .select("id, attrs, render_path, render_status")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .is("archetype_id", null)
    .is("photo_path", null);

  let updated = 0;
  for (const it of items ?? []) {
    const attrs = (it.attrs ?? {}) as {
      nombre?: string;
      categoria?: string;
      color_hex?: string;
      image_path?: string;
    };
    const hasRender = it.render_status === "done" && !!it.render_path;
    // Ya tiene de dónde sacar imagen, o le faltan datos para emparejar → salta.
    if (hasRender || attrs.image_path || !attrs.categoria || !attrs.color_hex) continue;
    const img = await borrowArchetypeImage(
      supabase,
      attrs.categoria,
      attrs.color_hex,
      gender,
      attrs.nombre ?? ""
    );
    if (!img) continue;
    const { error } = await supabase
      .from("items")
      .update({ attrs: { ...attrs, image_path: img } })
      .eq("id", it.id)
      .eq("user_id", user.id);
    if (!error) updated++;
  }

  revalidatePath("/closet");
  return { ok: true, updated };
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

  const { data, error } = await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id");
  if (error || !data || data.length === 0) return { ok: false };

  // Deja rastro: qué prendas se van y cuándo es señal de qué le sobra al clóset.
  await supabase
    .from("events")
    .insert({ user_id: user.id, type: "item_deleted", data: { item_id: id } });

  revalidatePath("/closet");
  return { ok: true };
}

// Edita los atributos de una prenda FOTOGRAFIADA (corrige lo que la IA leyó mal).
// Solo aplica a source='photo': los arquetipos derivan su display del catálogo,
// así que editarlos no tendría efecto (se podan, no se editan).
// material/patron/color_secundario son corregibles porque una mala lectura de
// visión (o del backfill) es señal DURA para el motor ("lana" excluye la prenda
// de looks de calor) — write-once sería incorregible.
export async function updateItemAttrs(
  id: string,
  patch: {
    nombre?: string;
    categoria?: string;
    formalidad?: string;
    temporada?: string;
    material?: string;
    patron?: string;
    color_secundario?: string;
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
  // La UI manda valores de selects fijos; el tope es la frontera de confianza
  // (estos attrs entran a prompts del motor — sin tope, un cliente manipulado
  // mete párrafos por esta puerta).
  if (patch.categoria) clean.categoria = patch.categoria.slice(0, 30);
  if (patch.formalidad) clean.formalidad = patch.formalidad.slice(0, 30);
  if (patch.temporada) clean.temporada = patch.temporada.slice(0, 30);
  // Atributos ricos: mandar el campo con string vacío = "quitar el dato"
  // (una lectura equivocada se borra, no solo se reemplaza).
  if (patch.material !== undefined) {
    const v = cleanTextAttr(patch.material, MAX_MATERIAL_LEN);
    if (v) clean.material = v;
    else delete clean.material;
  }
  if (patch.patron !== undefined) {
    const v = cleanPatron(patch.patron);
    if (v) clean.patron = v;
    else delete clean.patron;
  }
  if (patch.color_secundario !== undefined) {
    const v = cleanTextAttr(patch.color_secundario, MAX_COLOR_LEN);
    if (v) clean.color_secundario = v;
    else delete clean.color_secundario;
  }

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
        largo: it.attrs.largo,
        corte: it.attrs.corte,
        manga: it.attrs.manga,
        ...cleanAtributosRicos(it.attrs),
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
