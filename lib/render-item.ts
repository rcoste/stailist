import type { SupabaseClient } from "@supabase/supabase-js";
import { generateArchetypeImage } from "@/lib/archetype-image";
import { garmentRenderDesc } from "@/lib/garment-desc";

// Render limpio (tipo catálogo) de una prenda del clóset SIN imagen, desde sus
// atributos (texto→imagen con Gemini), subido a Storage y cacheado en el item
// (render_path + render_status='done'). Idempotente: si ya tiene de dónde sacar
// imagen o ya se está renderizando, no hace nada. Compartido por el endpoint
// /api/render-item (auto-sanado del clóset) y por "ya lo tengo" (cápsula/viaje).
export type RenderItemResult = {
  ok: boolean;
  skipped?: boolean;
  path?: string;
  error?: string;
};

export async function renderItemImage(
  supabase: SupabaseClient,
  userId: string,
  itemId: string
): Promise<RenderItemResult> {
  const { data: item } = await supabase
    .from("items")
    .select("id, archetype_id, photo_path, render_status, render_path, attrs")
    .eq("id", itemId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!item) return { ok: false, error: "not_found" };

  const attrs = (item.attrs ?? {}) as {
    nombre?: string;
    color?: string;
    categoria?: string;
    tipo?: string;
    image_path?: string;
    formalidad?: string;
    temporada?: string;
    largo?: string;
    corte?: string;
    manga?: string;
    visual?: string;
  };

  // Idempotencia: ya tiene imagen (arquetipo, render previo, foto, o prestada) o
  // ya hay un render en curso → no regeneres.
  const yaTieneImagen =
    !!item.archetype_id ||
    (item.render_status === "done" && !!item.render_path) ||
    !!item.photo_path ||
    !!attrs.image_path;
  if (yaTieneImagen || item.render_status === "pending") {
    return { ok: true, skipped: true };
  }

  const nombre = (attrs.nombre ?? "").trim();
  if (!nombre) return { ok: false, error: "sin_atributos" };
  const categoria = attrs.categoria ?? attrs.tipo ?? "";

  // Marca "en curso" antes del trabajo pesado (guard anti doble-generación).
  await supabase
    .from("items")
    .update({ render_status: "pending" })
    .eq("id", itemId)
    .eq("user_id", userId);

  // Descripción rica: detalle visual del estilista si lo hay, o los atributos que
  // la prenda ya carga (categoría, formalidad, largo/corte/manga de la visión).
  const conColor = garmentRenderDesc({
    nombre,
    color: attrs.color,
    categoria: attrs.categoria,
    formalidad: attrs.formalidad,
    temporada: attrs.temporada,
    largo: attrs.largo,
    corte: attrs.corte,
    manga: attrs.manga,
    visual: attrs.visual,
  });
  const type = categoria === "calzado" ? "shoes" : "flat";

  // Género del usuario: sin esto, prendas ambiguas (traje de baño, sandalias)
  // se renderizan de mujer por default. Lo pasamos al prompt para desambiguar.
  const { data: profile } = await supabase
    .from("profiles")
    .select("gender")
    .eq("id", userId)
    .single();
  const gender = (profile?.gender as "hombre" | "mujer" | null) ?? null;

  const bytes = await generateArchetypeImage(conColor, type, gender);
  if (!bytes) {
    await supabase
      .from("items")
      .update({ render_status: "failed" })
      .eq("id", itemId)
      .eq("user_id", userId);
    return { ok: false, error: "render_fallo" };
  }

  const path = `${userId}/render-${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage
    .from("prendas")
    .upload(path, bytes, { contentType: "image/jpeg" });
  if (up.error) {
    await supabase
      .from("items")
      .update({ render_status: "failed" })
      .eq("id", itemId)
      .eq("user_id", userId);
    return { ok: false, error: "upload_fallo" };
  }

  await supabase
    .from("items")
    .update({ render_path: path, render_status: "done" })
    .eq("id", itemId)
    .eq("user_id", userId);

  return { ok: true, path };
}
