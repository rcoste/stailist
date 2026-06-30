"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  ASSESSMENT_QUESTIONS,
  closetSignature,
  type CapsuleDecision,
  type CapsuleMatch,
  type CapsuleOverrides,
  type CapsuleTarget,
  type MatchEntry,
} from "@/lib/capsule";
import { generateCapsuleTarget } from "@/lib/engine/capsule-target";
import { matchCapsule } from "@/lib/engine/capsule-match";
import { borrowArchetypeImage, loadClosetLite } from "@/lib/capsule-data";
import { familiaToHex } from "@/lib/capsule-images";
import { renderItemImage } from "@/lib/render-item";
import type { Season } from "@/lib/colorimetria";
import type { Build, Volume } from "@/lib/silueta";
import type { LifestyleAnswers } from "@/lib/capsule";

export type CapsuleState = { status: "idle" } | { status: "error"; message: string };

// Guarda el assessment, genera la cápsula ideal (capa 1) y corre el match contra
// el clóset (capa 2). Todo se persiste; la tarjeta del clóset lee el cache.
export async function saveLifestyle(
  _prev: CapsuleState,
  formData: FormData
): Promise<CapsuleState> {
  const answers: LifestyleAnswers = {};
  for (const q of ASSESSMENT_QUESTIONS) {
    const val = String(formData.get(q.id) ?? "");
    if (!q.options.some((o) => o.value === val)) {
      return { status: "error", message: "Te faltó responder una — complétalas y va de nuevo." };
    }
    answers[q.id] = val;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("gender, taste_tags, style_archetype, palette_season, palette_flow, body_build, body_volume, style_reference")
    .eq("id", user.id)
    .single();
  const gender = (profile?.gender as "hombre" | "mujer" | null) ?? null;
  const styleRef =
    (profile?.style_reference as { summary?: string } | null)?.summary ?? null;

  let target: CapsuleTarget;
  try {
    target = await generateCapsuleTarget({
      answers,
      gender,
      tasteTags: (profile?.taste_tags ?? []) as string[],
      archetype:
        (profile?.style_archetype as { nombre: string; descripcion: string } | null) ?? null,
      season: (profile?.palette_season as Season | null) ?? null,
      flow: (profile?.palette_flow as Season | null) ?? null,
      build: (profile?.body_build as Build | null) ?? null,
      volume: (profile?.body_volume as Volume | null) ?? null,
      styleReference: styleRef,
    });
    target.styleSig = styleRef; // firma del estilo con el que se generó
  } catch {
    await supabase
      .from("profiles")
      .update({ lifestyle: answers, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    return {
      status: "error",
      message: "Guardé tus respuestas pero no pude armar tu cápsula. Inténtalo de nuevo en un momento.",
    };
  }

  // Match contra el clóset (capa 2). Si falla, guardamos la cápsula sin match;
  // la tarjeta ofrecerá recalcular.
  const closet = await loadClosetLite(supabase, user.id);
  let match = null;
  try {
    match = await matchCapsule(target, closet, gender);
  } catch {
    match = null;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      lifestyle: answers,
      capsule_target: target,
      capsule_match: match,
      capsule_overrides: null, // cápsula nueva → se borran las decisiones viejas
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) {
    return { status: "error", message: "No pude guardar tu cápsula — dale otra vez." };
  }

  redirect("/closet/capsula");
}

// Decisión del usuario sobre una prenda "parecido": aceptar (cuenta como cubierta)
// o rechazar (quiere la ideal → te falta). Toggle: re-elegir lo mismo lo deshace
// (eso también es el "cambiar" de la UI). Se llama directo desde el cliente con
// estado optimista, por eso recibe args planos en vez de FormData.
export async function setCapsuleOverride(
  index: number,
  decision: CapsuleDecision
): Promise<void> {
  if (!Number.isInteger(index) || (decision !== "accept" && decision !== "reject")) return;
  const key = String(index);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("capsule_overrides")
    .eq("id", user.id)
    .single();
  const current = ((profile?.capsule_overrides as CapsuleOverrides | null) ?? {}) as CapsuleOverrides;

  if (current[key] === decision) delete current[key];
  else current[key] = decision;

  await supabase.from("profiles").update({ capsule_overrides: current }).eq("id", user.id);
  revalidatePath("/closet/capsula");
  revalidatePath("/closet");
}

// Recalcula SOLO el match contra el clóset actual (cuando agregaste/quitaste
// prendas). No regenera la cápsula ideal.
export async function recalcularMatch(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("capsule_target, gender")
    .eq("id", user.id)
    .single();
  const target = profile?.capsule_target as CapsuleTarget | null;
  if (!target) return;
  const gender = (profile?.gender as "hombre" | "mujer" | null) ?? null;

  // Si el match falla (timeout/red), no tiramos la acción: dejamos el match como
  // estaba y revalidamos. El card seguirá mostrando "recalcular" para reintentar.
  try {
    const closet = await loadClosetLite(supabase, user.id);
    const match = await matchCapsule(target, closet, gender);
    await supabase.from("profiles").update({ capsule_match: match }).eq("id", user.id);
  } catch {
    // swallow — el usuario puede reintentar con el botón.
  }
  revalidatePath("/closet");
}

// Regenera la cápsula IDEAL con el perfil actual (p.ej. tras cambiar el estilo de
// referencia). Reusa las respuestas de vida guardadas; vuelve a calcular el match.
// Lo dispara el banner "tu estilo cambió" — el usuario decide (no es automático).
export async function regenerateCapsuleTarget(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "lifestyle, gender, taste_tags, style_archetype, palette_season, palette_flow, body_build, body_volume, style_reference"
    )
    .eq("id", user.id)
    .single();
  const answers = (profile?.lifestyle as LifestyleAnswers | null) ?? null;
  if (!answers) return; // sin assessment no hay cápsula que regenerar
  const gender = (profile?.gender as "hombre" | "mujer" | null) ?? null;
  const styleRef =
    (profile?.style_reference as { summary?: string } | null)?.summary ?? null;

  let target: CapsuleTarget;
  try {
    target = await generateCapsuleTarget({
      answers,
      gender,
      tasteTags: (profile?.taste_tags ?? []) as string[],
      archetype:
        (profile?.style_archetype as { nombre: string; descripcion: string } | null) ?? null,
      season: (profile?.palette_season as Season | null) ?? null,
      flow: (profile?.palette_flow as Season | null) ?? null,
      build: (profile?.body_build as Build | null) ?? null,
      volume: (profile?.body_volume as Volume | null) ?? null,
      styleReference: styleRef,
    });
    target.styleSig = styleRef;
  } catch {
    return;
  }

  let match = null;
  try {
    match = await matchCapsule(target, await loadClosetLite(supabase, user.id), gender);
  } catch {
    match = null;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ capsule_target: target, capsule_match: match, capsule_overrides: null })
    .eq("id", user.id);
  if (error) return;
  revalidatePath("/closet/capsula");
  revalidatePath("/closet");
}

// "Ya tengo esta" sobre una prenda que te FALTA: la suma al clóset (como prenda
// propia sin foto, con sus atributos de la cápsula ideal) Y la marca cubierta en
// el match — sin disparar un recálculo completo (caro). Para que no salte el
// banner de "tu clóset cambió", actualizamos la firma del match a la del clóset
// nuevo: agregar una prenda solo puede sumar cobertura, nunca quitarla, así que
// las demás entries siguen válidas. Devuelve el id del item para poder deshacer.
export async function markFaltaOwned(
  index: number
): Promise<{ ok: boolean; itemId: string | null }> {
  if (!Number.isInteger(index) || index < 0) return { ok: false, itemId: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, itemId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("capsule_target, capsule_match, gender")
    .eq("id", user.id)
    .single();
  const target = profile?.capsule_target as CapsuleTarget | null;
  const match = profile?.capsule_match as CapsuleMatch | null;
  const item = target?.items[index];
  if (!target || !match || !item) return { ok: false, itemId: null };

  // La prenda no tiene foto propia, pero le prestamos el flat-lay de un arquetipo
  // del catálogo de su MISMA categoría y color parecido, para que no salga como un
  // bloque de color en clóset/outfits. Si no hay uno cercano, cae al swatch.
  const imagePath = await borrowArchetypeImage(
    supabase,
    item.category,
    familiaToHex(item.colorFamilia),
    (profile?.gender as "hombre" | "mujer" | null) ?? null,
    `${item.tipo} ${item.nombre}`
  );

  // Inserta la prenda en el clóset (source=photo; sin photo propia → usa la imagen
  // prestada del arquetipo o, si no hay, el swatch de color; el motor la usa por
  // sus attrs).
  const { data: inserted, error: insErr } = await supabase
    .from("items")
    .insert({
      user_id: user.id,
      source: "photo",
      attrs: {
        nombre: item.nombre,
        categoria: item.category,
        color: item.colorFamilia,
        color_hex: familiaToHex(item.colorFamilia),
        formalidad: item.formalidad,
        temporada: item.temporada,
        ...(imagePath ? { image_path: imagePath } : {}),
      },
    })
    .select("id")
    .single();
  if (insErr || !inserted) return { ok: false, itemId: null };

  // Si no hubo imagen prestada (no había arquetipo cercano — p.ej. un suéter
  // negro), le generamos su render limpio AHORA (inline) para que no quede como
  // un swatch. El cliente muestra un spinner mientras tanto.
  if (!imagePath) {
    await renderItemImage(supabase, user.id, inserted.id as string);
  }

  // Marca esa prenda ideal como cubierta y refresca la firma al clóset nuevo.
  const closet = await loadClosetLite(supabase, user.id);
  const entries: MatchEntry[] = target.items.map((_, i) =>
    i === index
      ? { status: "tienes", by: item.nombre }
      : match.entries[i] ?? { status: "falta", by: null }
  );
  const newMatch: CapsuleMatch = { signature: closetSignature(closet), entries };
  await supabase.from("profiles").update({ capsule_match: newMatch }).eq("id", user.id);

  // OJO: revalidar la ruta DONDE estás (/closet/capsula), no solo /closet —
  // si no, la fila no se reubica a "Ya lo tienes" y el botón "ya la tengo" se
  // siente muerto aunque la prenda sí se agregó.
  revalidatePath("/closet/capsula");
  revalidatePath("/closet");
  return { ok: true, itemId: inserted.id as string };
}

// Foto real OPCIONAL para una prenda que acabas de marcar "ya la tengo": el cliente
// ya subió la foto a su carpeta del bucket; aquí la fijamos como photo_path y
// limpiamos el render generado para que la foto real mande (prioridad: render >
// photo, así que sin limpiar el render no se vería). No bloqueante: si nunca la
// sube, la prenda se queda con su imagen auto.
export async function attachOwnPhoto(
  itemId: string,
  photoPath: string
): Promise<{ ok: boolean }> {
  if (!itemId || !photoPath) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  // La foto debe estar dentro de la carpeta del usuario (defensa además de RLS).
  if (!photoPath.startsWith(`${user.id}/`)) return { ok: false };

  const { error } = await supabase
    .from("items")
    .update({ photo_path: photoPath, render_status: null, render_path: null })
    .eq("id", itemId)
    .eq("user_id", user.id);
  if (error) return { ok: false };

  revalidatePath("/closet/capsula");
  revalidatePath("/closet");
  return { ok: true };
}
