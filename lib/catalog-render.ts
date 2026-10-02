import type { SupabaseClient } from "@supabase/supabase-js";
import { generateArchetypeImage } from "@/lib/archetype-image";
import { catalogLookupKeys, catalogStorageKey } from "@/lib/capsule-images";
import { garmentRenderDesc } from "@/lib/garment-desc";
import { guardarRenderDeCatalogo } from "@/lib/supabase/biblioteca-compartida";

const BUCKET = "catalog";

export function catalogPublicUrl(supabase: SupabaseClient, path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Biblioteca general compartida: genera (si no existe) la imagen ideal de un combo
// tipo+color+género y la registra para que TODOS los usuarios la reusen. Idempotente
// (si ya está en el registro, devuelve esa). La LECTURA va con la sesión de la
// persona; la ESCRITURA la hace el servidor (lib/supabase/biblioteca-compartida.ts):
// antes escribía el cliente de cada quien y cualquier cuenta podía subir o
// registrar lo que quisiera en una biblioteca que ven todos.
export async function ensureCatalogRender(
  supabase: SupabaseClient,
  args: {
    tipo: string;
    colorFamilia: string;
    nombre: string;
    categoria: string;
    gender: "hombre" | "mujer" | null;
    formalidad?: string | null;
    temporada?: string | null;
    visual?: string | null;
    /** Quién la pidió: sin esto la imagen no deja recibo (ver archetype-image). */
    userId?: string | null;
  }
): Promise<{ ok: boolean; url?: string; error?: string }> {
  // Se GUARDA con la clave canónica; se BUSCA con la canónica y la cruda, para
  // no volver a pagar las 316 imágenes que se guardaron con el tipo tal cual
  // venía del LLM (ver catalogLookupKeys).
  const key = catalogStorageKey(args.tipo, args.colorFamilia, args.gender);
  const { data: existing } = await supabase
    .from("catalog_renders")
    .select("key, path")
    .in("key", catalogLookupKeys(args.tipo, args.colorFamilia, args.gender));
  const hit = (existing ?? []).find((r) => r.path);
  if (hit?.path) return { ok: true, url: catalogPublicUrl(supabase, hit.path as string) };

  // Descripción rica para el generador: usa el detalle visual del estilista si
  // existe, o lo arma con los atributos estructurados de la prenda.
  const desc = garmentRenderDesc({
    nombre: args.nombre,
    // El tipo lleva el detalle que el nombre calla ("sueter-grueso"), y hasta
    // hoy se quedaba en la firma sin llegar al prompt.
    tipo: args.tipo,
    color: args.colorFamilia,
    categoria: args.categoria,
    formalidad: args.formalidad,
    temporada: args.temporada,
    visual: args.visual,
    // Una pieza ideal nunca trae patrón: pedir "liso" es lo que evita que el
    // modelo elija la superficie por su cuenta.
    sinPatronDeclarado: true,
  });
  const type = args.categoria === "calzado" ? "shoes" : "flat";
  // `tarea: "capsula-ideal"` distingue estas imágenes de las del clóset en el
  // panel: son la misma llamada pero responden preguntas distintas (cuánto
  // cuesta enseñar lo que te falta vs. dibujar lo que ya tienes).
  const bytes = await generateArchetypeImage(
    desc,
    type,
    args.gender ?? undefined,
    "3:4",
    args.userId ? { supabase, userId: args.userId, tarea: "capsula-ideal" } : null
  );
  if (!bytes) return { ok: false, error: "render_fallo" };

  const guardado = await guardarRenderDeCatalogo(key, bytes);
  if (!guardado.ok) return { ok: false, error: guardado.error };
  return { ok: true, url: catalogPublicUrl(supabase, guardado.path) };
}
