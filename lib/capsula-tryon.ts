import type { SupabaseClient } from "@supabase/supabase-js";
import { capsuleLookKey, type CapsuleItem } from "@/lib/capsule";
import { catalogKeysParaBuscar } from "@/lib/capsule-images";
import { catalogPublicUrl } from "@/lib/catalog-render";
import type { TripOutfit } from "@/lib/trip";

// LAS PRENDAS DE UN LOOK DE ESENCIALES, PARA PROBÁRTELO (2026-10-19).
//
// Un look de esenciales puede llevar una pieza de tu wishlist que todavía no
// tienes ("te falta"). Hasta hoy eso apagaba el try-on: la fila de `outfits`
// sólo guarda ids del clóset y la pieza que falta no tiene id. Pero verte con
// la pieza ANTES de comprarla es justo para lo que sirve el try-on, y el look
// ya la marca como "te falta" — lo pidió Roberto viendo los looks de su esposa.
//
// Todo se resuelve AQUÍ, en el servidor, desde los datos de la persona: el
// navegador nunca manda la URL de una imagen para el try-on.

/** Nombre → id de prenda del clóset (el nombre del arquetipo, o attrs.nombre). */
export async function resolverPrendasDelCloset(
  supabase: SupabaseClient,
  userId: string,
  prendas: string[]
): Promise<Map<string, string>> {
  const { data: items } = await supabase
    .from("items")
    .select("id, attrs, archetypes(name)")
    .eq("user_id", userId)
    .is("deleted_at", null);
  const byName = new Map<string, string>();
  for (const it of items ?? []) {
    const arch = it.archetypes as { name?: string } | null;
    const attrs = (it.attrs ?? {}) as { nombre?: string };
    const name = arch?.name ?? attrs.nombre;
    if (name && !byName.has(name)) byName.set(name, it.id as string);
  }
  const out = new Map<string, string>();
  for (const n of prendas) {
    const id = byName.get(n);
    if (id) out.set(n, id);
  }
  return out;
}

export type PiezaQueFalta = { nombre: string; url: string | null };

/**
 * Las prendas del look de esenciales cuya llave es `lookKey`: las del clóset
 * (ids, resueltas HOY — si ya marcó "ya la tengo", la pieza deja de faltar) y
 * las que faltan, con la imagen de catálogo que el look ya enseña. Sin imagen
 * de catálogo, la pieza va sólo por su nombre (el try-on la dibuja del texto).
 * `null` si el look ya no existe (rehizo sus esenciales).
 */
export async function prendasDelLookDeCapsula(
  supabase: SupabaseClient,
  userId: string,
  lookKey: string
): Promise<{ itemIds: string[]; faltan: PiezaQueFalta[] } | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("capsule_outfits, capsule_target, gender")
    .eq("id", userId)
    .single();
  const looks = (profile?.capsule_outfits as TripOutfit[] | null) ?? [];
  const look = looks.find((l) => capsuleLookKey(l.prendas) === lookKey);
  if (!look) return null;

  const enCloset = await resolverPrendasDelCloset(supabase, userId, look.prendas);
  const faltanNombres = look.prendas.filter((n) => !enCloset.has(n));
  const itemIds = look.prendas.map((n) => enCloset.get(n)).filter((id): id is string => !!id);
  if (faltanNombres.length === 0) return { itemIds, faltan: [] };

  // La imagen de la pieza que falta es la del catálogo compartido, buscada con
  // las mismas llaves que usa la pantalla de esenciales (app/closet/capsula/page.tsx).
  const target = (profile?.capsule_target as { items?: CapsuleItem[] } | null)?.items ?? [];
  const gender = (profile?.gender as "hombre" | "mujer" | null) ?? null;
  const llaves = faltanNombres.map((nombre) => {
    const it = target.find((t) => t.nombre === nombre);
    return { nombre, sks: it ? catalogKeysParaBuscar(it.tipo, it.colorFamilia, gender, it.visual) : [] };
  });
  const todas = [...new Set(llaves.flatMap((l) => l.sks))];
  const { data: crows } = todas.length
    ? await supabase.from("catalog_renders").select("key, path").in("key", todas)
    : { data: [] as { key: string; path: string }[] };
  const pathBySk = new Map((crows ?? []).map((r) => [r.key as string, r.path as string]));
  const faltan = llaves.map(({ nombre, sks }) => {
    const path = sks.map((k) => pathBySk.get(k)).find(Boolean);
    return { nombre, url: path ? catalogPublicUrl(supabase, path) : null };
  });
  return { itemIds, faltan };
}
