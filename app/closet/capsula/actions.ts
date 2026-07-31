"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  assessmentQuestions,
  type AssessmentQuestion,
  type CapsuleDecision,
  type CapsuleItem,
  type CapsuleMatch,
  type CapsuleOverrides,
  type CapsuleSwaps,
  type CapsuleTarget,
  type MatchEntry,
  SWAP_CAP,
  type VetoReason,
  visibleQuestions,
} from "@/lib/capsule";
import { EMPTY_VETOES, type StyleVetoes, vetoLabels } from "@/lib/vetoes";
import { generateCapsuleTarget } from "@/lib/engine/capsule-target";
import { generateCapsuleSwap } from "@/lib/engine/capsule-swap";
import { matchCapsule, matchSignature } from "@/lib/engine/capsule-match";
import { borrowArchetypeImage, loadClosetLite } from "@/lib/capsule-data";
import { familiaToHex } from "@/lib/capsule-images";
import { renderItemImage } from "@/lib/render-item";
import type { Season } from "@/lib/colorimetria";
import type { Build, Volume } from "@/lib/silueta";
import { ageStylingLine, type AgeRange } from "@/lib/edad";
import type { LifestyleAnswers } from "@/lib/capsule";
import { styleReferenceForEngine, styleSignature } from "@/lib/estilo-referencia";
import { loadTasteSignal } from "@/lib/engine/taste-signal";

export type CapsuleState = { status: "idle" } | { status: "error"; message: string };

// Guarda el assessment, genera la cápsula ideal (capa 1) y corre el match contra
// el clóset (capa 2). Todo se persiste; la tarjeta del clóset lee el cache.
export async function saveLifestyle(
  _prev: CapsuleState,
  formData: FormData
): Promise<CapsuleState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Perfil y feedback en paralelo: loadTasteSignal no depende del perfil y esta
  // action ya carga con ~40s de Opus — cada round-trip serial cuenta.
  const [{ data: profile, error: profileErr }, tasteSignal] = await Promise.all([
    supabase
      .from("profiles")
      .select("gender, taste_tags, style_archetype, palette_season, palette_flow, body_build, body_volume, style_reference, style_questions, style_vetoes, style_words, age_range")
      .eq("id", user.id)
      .single(),
    loadTasteSignal(supabase, user.id),
  ]);
  if (profileErr) console.error(`capsula_profile_select_failed: ${profileErr.message}`);
  const gender = (profile?.gender as "hombre" | "mujer" | null) ?? null;
  const styleRef =
    styleReferenceForEngine(profile?.style_reference);
  // Preguntas fijas + las personalizadas de SU estilo (validamos contra ambas).
  const dynamicQ =
    (profile?.style_questions as { questions?: AssessmentQuestion[] } | null)?.questions ?? [];
  const allQ = [...assessmentQuestions(gender), ...dynamicQ];

  // Recolecta primero TODO lo que llegó, porque la visibilidad de una pregunta
  // condicional depende de otra respuesta (el clima de viaje solo aplica si dijo
  // que viaja). Validar sobre allQ exigía responder preguntas que el formulario
  // nunca mostró → bloqueaba a quien NO viaja. Se valida solo lo que aplica, y
  // lo que no aplica ni siquiera entra a `answers`.
  const recibido: LifestyleAnswers = {};
  for (const q of allQ) recibido[q.id] = String(formData.get(q.id) ?? "");
  const aplican = visibleQuestions(allQ, recibido);

  const answers: LifestyleAnswers = {};
  for (const q of aplican) {
    const raw = recibido[q.id] ?? "";
    if (q.multi) {
      const vals = raw.split(",").filter(Boolean);
      if (vals.length === 0 || !vals.every((v) => q.options.some((o) => o.value === v))) {
        return { status: "error", message: "Te faltó responder una — complétalas y va de nuevo." };
      }
      answers[q.id] = vals.join(",");
    } else {
      if (!q.options.some((o) => o.value === raw)) {
        return { status: "error", message: "Te faltó responder una — complétalas y va de nuevo." };
      }
      answers[q.id] = raw;
    }
  }

  // Guarda las respuestas ANTES de generar. Un timeout de Vercel mata la función
  // entera: el catch de abajo NUNCA corre, y el cuestionario se perdía completo
  // (le pasó a Roberto — 10 respuestas a la basura por un 504). Persistidas
  // primero, un timeout cuesta la cápsula pero no volver a contestar todo.
  await supabase
    .from("profiles")
    .update({ lifestyle: answers, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  let target: CapsuleTarget;
  try {
    target = await generateCapsuleTarget({
      answers,
      questions: allQ,
      gender,
      tasteTags: (profile?.taste_tags ?? []) as string[],
      archetype:
        (profile?.style_archetype as { nombre: string; descripcion: string } | null) ?? null,
      season: (profile?.palette_season as Season | null) ?? null,
      flow: (profile?.palette_flow as Season | null) ?? null,
      build: (profile?.body_build as Build | null) ?? null,
      volume: (profile?.body_volume as Volume | null) ?? null,
      styleReference: styleRef,
      vetoes: vetoLabels((profile?.style_vetoes as StyleVetoes | null) ?? EMPTY_VETOES),
      styleWords: (profile?.style_words as string | null) ?? null,
      tasteSignal,
      ageStyling: ageStylingLine((profile?.age_range as AgeRange | null) ?? null),
    });
    // Firma del estilo COMPLETO (referencia + sus palabras): si cualquiera
    // cambia después, la cápsula se ofrece a regenerar.
    target.styleSig = styleSignature(profile?.style_reference, (profile?.style_words as string | null) ?? null);
  } catch {
    // Las respuestas ya quedaron guardadas arriba.
    return {
      status: "error",
      message: "Guardé tus respuestas pero no pude armar tus esenciales. Inténtalo de nuevo en un momento.",
    };
  }

  // El match (otra llamada a Opus contra el clóset) se hace APARTE, no aquí: armar la
  // cápsula ya toma ~40s y sumar el match arriesga el límite de 60s de Vercel — la
  // función se mataba y salía "no pude armar tu cápsula". Guardamos SIN match; la
  // página muestra "calcular qué ya tienes" (recalcularMatch, con su propio budget).
  const { error } = await supabase
    .from("profiles")
    .update({
      lifestyle: answers,
      capsule_target: target,
      capsule_match: null,
      capsule_overrides: null, // cápsula nueva → se borran las decisiones viejas
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) {
    return { status: "error", message: "No pude guardar tus esenciales — dale otra vez." };
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

// Persiste el rechazo: guarda los swaps, marca ese slot como hueco en el match,
// suma un veto global si la señal es clara, y deja los looks de la cápsula viejos.
async function persistCapsuleReject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  index: number,
  nextSwaps: CapsuleSwaps,
  match: CapsuleMatch | null,
  vetoes: StyleVetoes,
  vetoTerm: string | null
): Promise<void> {
  const update: Record<string, unknown> = {
    capsule_swaps: nextSwaps,
    capsule_outfits_sig: null, // la cápsula cambió → los looks quedan viejos
  };
  if (match) {
    // La alternativa es una sugerencia nueva que (por defecto) no tiene: hueco real.
    update.capsule_match = {
      signature: match.signature,
      entries: match.entries.map((e, i) =>
        i === index ? { status: "falta" as const, by: null } : e
      ),
    };
  }
  if (vetoTerm) {
    const t = vetoTerm.trim().slice(0, 40).toLowerCase();
    const free = vetoes.free ?? [];
    if (t && !free.some((f) => f.toLowerCase() === t)) {
      update.style_vetoes = { chips: vetoes.chips ?? [], free: [...free, t].slice(0, 10) };
    }
  }
  await supabase.from("profiles").update(update).eq("id", userId);
  revalidatePath("/closet/capsula");
  revalidatePath("/closet");
}

// Camino A (issue #89): rechazar una prenda ideal de la cápsula. Genera al instante
// una alternativa del mismo rol (swap), hasta SWAP_CAP intentos; al tope retira el
// slot. La razón (opcional) afina el swap y puede sumar un veto global. Sirve tanto
// para el rechazo inicial como para "otra" (razón null). Client-side con retry.
export async function rejectCapsuleItem(
  index: number,
  reason: VetoReason | null = null
): Promise<{ ok: boolean }> {
  if (!Number.isInteger(index) || index < 0) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("capsule_target, capsule_match, capsule_swaps, gender, palette_season, palette_flow, style_vetoes")
    .eq("id", user.id)
    .single();
  const target = profile?.capsule_target as CapsuleTarget | null;
  const slot = target?.items[index];
  if (!target || !slot) return { ok: false };

  const swaps = ((profile?.capsule_swaps as CapsuleSwaps | null) ?? {}) as CapsuleSwaps;
  const key = String(index);
  const existing = swaps[key] ?? null;
  const newCount = (existing?.rejectedCount ?? 0) + 1;
  const shownItem = existing?.item ?? slot; // lo que ve ahora (ideal o alternativa)
  const rejectedNames = existing ? [slot.nombre, existing.item.nombre] : [slot.nombre];

  const gender = (profile?.gender as "hombre" | "mujer" | null) ?? null;
  const season = (profile?.palette_season as Season | null) ?? null;
  const flow = (profile?.palette_flow as Season | null) ?? null;
  const vetoes = (profile?.style_vetoes as StyleVetoes | null) ?? EMPTY_VETOES;

  const nextSwaps: CapsuleSwaps = { ...swaps };
  if (newCount < SWAP_CAP) {
    let alt: CapsuleItem;
    try {
      alt = await generateCapsuleSwap({
        target,
        index,
        rejectedNames,
        reason,
        gender,
        season,
        flow,
        vetoes: vetoLabels(vetoes),
      });
    } catch {
      return { ok: false };
    }
    nextSwaps[key] = { item: alt, rejectedCount: newCount, reason: reason ?? null };
  } else {
    // Tope de swaps: no gastamos más IA; el slot se retira de la cápsula.
    nextSwaps[key] = {
      item: shownItem,
      rejectedCount: newCount,
      reason: reason ?? null,
      dismissed: true,
    };
  }

  // Veto global SOLO con señal clara: color rechazado, tipo que no usa, o al retirar.
  const vetoTerm =
    reason === "color-no"
      ? shownItem.colorFamilia
      : reason === "no-lo-uso" || newCount >= SWAP_CAP
        ? shownItem.tipo?.replace(/-/g, " ") ?? null
        : null;

  await persistCapsuleReject(
    supabase,
    user.id,
    index,
    nextSwaps,
    (profile?.capsule_match as CapsuleMatch | null) ?? null,
    vetoes,
    vetoTerm
  );
  return { ok: true };
}

// "Quitar": retira el slot de la cápsula sin generar más alternativas (decisión
// explícita de la usuaria). Suma el tipo como veto.
// Retira el slot de la cápsula ("no me va" — no te la vuelvo a sugerir).
//
// `reason` llega desde la hoja de motivo, que el handoff hace OBLIGATORIA porque
// es la señal que evita repetir el error. Antes esta función no la aceptaba y
// heredaba la del swap anterior (casi siempre null): la hoja habría prometido
// "me sirve para no repetir el error" y el motivo se habría tirado a la basura.
export async function dismissCapsuleSlot(
  index: number,
  reason: VetoReason | null = null
): Promise<{ ok: boolean }> {
  if (!Number.isInteger(index) || index < 0) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("capsule_target, capsule_match, capsule_swaps, style_vetoes")
    .eq("id", user.id)
    .single();
  const target = profile?.capsule_target as CapsuleTarget | null;
  const slot = target?.items[index];
  if (!target || !slot) return { ok: false };

  const swaps = ((profile?.capsule_swaps as CapsuleSwaps | null) ?? {}) as CapsuleSwaps;
  const key = String(index);
  const existing = swaps[key] ?? null;
  const shownItem = existing?.item ?? slot;
  const nextSwaps: CapsuleSwaps = {
    ...swaps,
    [key]: {
      item: shownItem,
      rejectedCount: Math.max(existing?.rejectedCount ?? 0, 1),
      reason: reason ?? existing?.reason ?? null,
      dismissed: true,
    },
  };
  const vetoes = (profile?.style_vetoes as StyleVetoes | null) ?? EMPTY_VETOES;
  const vetoTerm = shownItem.tipo?.replace(/-/g, " ") ?? null;

  await persistCapsuleReject(
    supabase,
    user.id,
    index,
    nextSwaps,
    (profile?.capsule_match as CapsuleMatch | null) ?? null,
    vetoes,
    vetoTerm
  );
  return { ok: true };
}

// Calcula el match contra el clóset actual (tras armar la cápsula o cambiar el
// clóset). No regenera la cápsula ideal. Devuelve {ok} para que el cliente sepa si
// mostrar el resultado o el botón de reintentar.
export async function recalcularMatch(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("capsule_target, capsule_match, capsule_overrides, gender")
    .eq("id", user.id)
    .single();
  const target = profile?.capsule_target as CapsuleTarget | null;
  if (!target) return { ok: false };
  const gender = (profile?.gender as "hombre" | "mujer" | null) ?? null;
  const prev = (profile?.capsule_match as CapsuleMatch | null) ?? null;
  const overrides = ((profile?.capsule_overrides as CapsuleOverrides | null) ?? {}) as CapsuleOverrides;

  try {
    const closet = await loadClosetLite(supabase, user.id);
    const match = await matchCapsule(target, closet, gender);

    // Misma trampa que en "ya la tengo": si un slot pasó a "tienes" y NO lo era,
    // la decisión vieja (tomada sobre un "parecido") cambia de significado y lo
    // volvería un hueco falso. Se descarta. Si YA era "tienes", el override sí es
    // un desmentido legítimo del usuario y se respeta.
    const limpios: CapsuleOverrides = { ...overrides };
    match.entries.forEach((e, i) => {
      const antes = prev?.entries?.[i]?.status;
      if (e.status === "tienes" && antes !== "tienes") delete limpios[String(i)];
    });

    await supabase
      .from("profiles")
      .update({ capsule_match: match, capsule_overrides: limpios })
      .eq("id", user.id);
  } catch {
    return { ok: false }; // el cliente ofrece reintentar
  }
  // CLAVE: revalidar la ruta DONDE estás (/closet/capsula), no solo /closet — si no,
  // el match se guarda pero la página NO se actualiza y el botón "se siente muerto".
  revalidatePath("/closet/capsula");
  revalidatePath("/closet");
  return { ok: true };
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

  const [{ data: profile, error: profileErr }, tasteSignal] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "lifestyle, gender, taste_tags, style_archetype, palette_season, palette_flow, body_build, body_volume, style_reference, style_questions, style_vetoes, style_words, age_range"
      )
      .eq("id", user.id)
      .single(),
    loadTasteSignal(supabase, user.id),
  ]);
  if (profileErr) console.error(`capsula_regen_profile_select_failed: ${profileErr.message}`);
  const answers = (profile?.lifestyle as LifestyleAnswers | null) ?? null;
  if (!answers) return; // sin assessment no hay cápsula que regenerar
  const gender = (profile?.gender as "hombre" | "mujer" | null) ?? null;
  const styleRef =
    styleReferenceForEngine(profile?.style_reference);
  const dynamicQ =
    (profile?.style_questions as { questions?: AssessmentQuestion[] } | null)?.questions ?? [];

  let target: CapsuleTarget;
  try {
    target = await generateCapsuleTarget({
      answers,
      questions: [...assessmentQuestions(gender), ...dynamicQ],
      gender,
      tasteTags: (profile?.taste_tags ?? []) as string[],
      archetype:
        (profile?.style_archetype as { nombre: string; descripcion: string } | null) ?? null,
      season: (profile?.palette_season as Season | null) ?? null,
      flow: (profile?.palette_flow as Season | null) ?? null,
      build: (profile?.body_build as Build | null) ?? null,
      volume: (profile?.body_volume as Volume | null) ?? null,
      styleReference: styleRef,
      vetoes: vetoLabels((profile?.style_vetoes as StyleVetoes | null) ?? EMPTY_VETOES),
      styleWords: (profile?.style_words as string | null) ?? null,
      tasteSignal,
      ageStyling: ageStylingLine((profile?.age_range as AgeRange | null) ?? null),
    });
    target.styleSig = styleSignature(profile?.style_reference, (profile?.style_words as string | null) ?? null);
  } catch {
    return;
  }

  // Match aparte (evita el límite de 60s de Vercel — ver saveLifestyle). Se guarda
  // sin match; la página ofrece "calcular qué ya tienes".
  const { error } = await supabase
    .from("profiles")
    .update({ capsule_target: target, capsule_match: null, capsule_overrides: null })
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
        ...(item.visual ? { visual: item.visual } : {}),
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
  const newMatch: CapsuleMatch = { signature: matchSignature(closet), entries };

  // LIMPIA la decisión vieja de este slot. Un override "reject" puede venir de
  // cuando era "parecido" ("quiero la sugerida"), y desde que un reject sobre un
  // "tienes" significa "esto NO lo cubre", ese resto convertía la prenda recién
  // agregada en un hueco con el cartel absurdo "dijiste que tu X no la cubre"
  // (le pasó a Roberto con su traje marino). Decir "ya la tengo" es la señal más
  // explícita posible de propiedad: manda sobre cualquier decisión previa.
  const { data: ovRow } = await supabase
    .from("profiles")
    .select("capsule_overrides")
    .eq("id", user.id)
    .single();
  const overrides = ((ovRow?.capsule_overrides as CapsuleOverrides | null) ?? {}) as CapsuleOverrides;
  delete overrides[String(index)];

  await supabase
    .from("profiles")
    .update({ capsule_match: newMatch, capsule_overrides: overrides })
    .eq("id", user.id);

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
