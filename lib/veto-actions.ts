"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { VETO_CATALOG } from "@/lib/vetoes";
import { registrarEvento } from "@/lib/telemetria";

const VALID_IDS = new Set(VETO_CATALOG.map((c) => c.id));

// Guarda los vetos de estilo del usuario (issue #2). Sanea: chips solo del
// catálogo; free recortado, sin vacíos ni duplicados, con tope. Registra el
// evento para medir adopción y revalida las pantallas que leen vetos.
export async function updateVetoes(
  chips: string[],
  free: string[]
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const cleanChips = [...new Set(chips.filter((c) => VALID_IDS.has(c)))];

  const seen = new Set<string>();
  const cleanFree: string[] = [];
  for (const f of free) {
    const t = f.trim().slice(0, 40);
    const key = t.toLowerCase();
    if (!t || seen.has(key)) continue;
    seen.add(key);
    cleanFree.push(t);
    if (cleanFree.length >= 10) break;
  }

  const vetoes = { chips: cleanChips, free: cleanFree };
  const { error } = await supabase
    .from("profiles")
    .update({ style_vetoes: vetoes, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { ok: false };

  await registrarEvento(supabase, {
    user_id: user.id,
    type: "style_vetoes_edit",
    data: { chips: cleanChips.length, free: cleanFree.length },
  });

  revalidatePath("/perfil");
  revalidatePath("/hoy");
  return { ok: true };
}
