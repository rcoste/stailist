"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type StyleRefPayload = {
  summary: string;
  tags: string[];
  fit?: { verdict: string; note: string } | null;
  image_paths: string[];
};

// Paths de las fotos guardadas en una referencia (tolera el shape viejo image_path).
function refPaths(ref: unknown): string[] {
  const r = ref as { image_paths?: string[]; image_path?: string } | null;
  if (!r) return [];
  if (Array.isArray(r.image_paths)) return r.image_paths;
  return r.image_path ? [r.image_path] : [];
}

// Guarda la referencia que el usuario DECIDIÓ absorber (tras ver el pushback).
// Borra las fotos de la referencia anterior si las reemplaza.
export async function saveStyleReference(
  data: StyleRefPayload
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  if (!data?.summary || !Array.isArray(data.image_paths) || data.image_paths.length === 0) {
    return { ok: false };
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("style_reference")
    .eq("id", user.id)
    .single();
  const old = refPaths(prof?.style_reference).filter((p) => !data.image_paths.includes(p));
  if (old.length) await supabase.storage.from("prendas").remove(old);

  const style_reference = {
    summary: data.summary,
    tags: data.tags ?? [],
    fit: data.fit ?? null,
    image_paths: data.image_paths,
  };
  const { error } = await supabase
    .from("profiles")
    .update({ style_reference })
    .eq("id", user.id);
  if (error) return { ok: false };
  revalidatePath("/perfil");
  return { ok: true };
}

// El usuario DESCARTÓ el preview → borra las fotos huérfanas que se subieron.
export async function discardStyleReference(
  paths: string[]
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const mine = (paths ?? []).filter((p) => p.startsWith(`${user.id}/`));
  if (mine.length) await supabase.storage.from("prendas").remove(mine);
  return { ok: true };
}

// Quita el estilo de referencia guardado: borra sus fotos y limpia la columna.
export async function removeStyleReference(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: prof } = await supabase
    .from("profiles")
    .select("style_reference")
    .eq("id", user.id)
    .single();
  const paths = refPaths(prof?.style_reference);
  if (paths.length) await supabase.storage.from("prendas").remove(paths);

  const { error } = await supabase
    .from("profiles")
    .update({ style_reference: null })
    .eq("id", user.id);
  if (error) return { ok: false };
  revalidatePath("/perfil");
  return { ok: true };
}

// Cierra la sesión y manda al login. No es destructivo (se puede volver a entrar
// con el código OTP), por eso no pide confirmación.
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
