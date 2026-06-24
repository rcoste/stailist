"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  capsuleRows,
  closetSignature,
  type CapsuleMatch,
  type CapsuleOverrides,
  type CapsuleTarget,
} from "@/lib/capsule";
import { loadClosetLite } from "@/lib/capsule-data";
import {
  generateTripOutfits,
  reviewTripOutfits,
  type PackableItem,
  type TripOutfitInputs,
  type TripWeatherInput,
} from "@/lib/engine/trip-outfits";
import { siluetaPromptLine, type Build, type Volume } from "@/lib/silueta";
import type { Occasion, TripOutfit } from "@/lib/trip";

const MAX_LOOKS = 16;
const outfitKey = (o: { prendas: string[] }) => [...o.prendas].sort().join("|");

// Ocasiones de la VIDA (no de un viaje): se derivan del cuestionario. Base ciudad
// (todos tienen día a día); + trabajo si va a oficina; + noche si sale/tiene
// eventos; + aire si hace actividades al aire libre.
function occasionsFromLifestyle(life: Record<string, string> | null): Occasion[] {
  const set = new Set<Occasion>(["ciudad"]);
  if (life) {
    if (["oficina_formal", "oficina_casual", "fisico"].includes(life.trabajo)) set.add("trabajo");
    if (life.eventos !== "nunca" || life.actividades === "noche") set.add("noche");
    if (life.actividades === "aire") set.add("aire");
  }
  return [...set];
}

// Clima del cuestionario → una temperatura representativa para que los looks
// tengan el abrigo/ligereza correctos. El motor también acepta null.
function weatherFromClima(clima: string | undefined): TripWeatherInput | null {
  if (clima === "frio") return { temp_c: 8, condition: "frío", estimated: true };
  if (clima === "templado") return { temp_c: 19, condition: "templado", estimated: true };
  if (clima === "calor") return { temp_c: 28, condition: "cálido", estimated: true };
  return null;
}

// "Ver los looks que tu cápsula arma": genera outfits con las prendas que YA
// TIENES de tu cápsula (los "tienes" del match), con el mismo motor Sudoku del
// viaje. Cachea en profiles.capsule_outfits + firma del clóset.
export async function generateCapsuleOutfits(
  append = false
): Promise<{ ok: boolean; count: number; added: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, count: 0, added: 0 };

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "capsule_target, capsule_match, capsule_overrides, lifestyle, gender, taste_tags, style_archetype, body_build, body_volume, capsule_outfits"
    )
    .eq("id", user.id)
    .single();
  const target = profile?.capsule_target as CapsuleTarget | null;
  if (!target) return { ok: false, count: 0, added: 0 };
  const match = (profile?.capsule_match as CapsuleMatch | null) ?? null;
  const overrides = (profile?.capsule_overrides as CapsuleOverrides | null) ?? null;

  const closet = await loadClosetLite(supabase, user.id);
  // Empacable = lo que de verdad TIENES de tu cápsula (cubierto), por el nombre de
  // la prenda del clóset que lo cubre.
  const packable: PackableItem[] = capsuleRows(target, match, overrides)
    .filter((r) => r.covered && !!r.by)
    .map((r, i) => ({
      n: i,
      nombre: r.by as string,
      category: r.item.category,
      color: r.item.colorFamilia,
      formalidad: r.item.formalidad,
    }));

  const sig = closetSignature(closet);
  if (packable.length < 2) {
    await supabase
      .from("profiles")
      .update({ capsule_outfits: [], capsule_outfits_sig: sig })
      .eq("id", user.id);
    return { ok: true, count: 0, added: 0 };
  }

  const existing = append ? ((profile?.capsule_outfits as TripOutfit[] | null) ?? []) : [];
  const life = (profile?.lifestyle as Record<string, string> | null) ?? null;

  const genInputs: TripOutfitInputs = {
    packable,
    ocasiones: occasionsFromLifestyle(life),
    weather: weatherFromClima(life?.clima),
    gender: (profile?.gender as "hombre" | "mujer" | null) ?? null,
    tasteTags: (profile?.taste_tags ?? []) as string[],
    archetype:
      (profile?.style_archetype as { nombre: string; descripcion: string } | null) ?? null,
    silueta: siluetaPromptLine(
      (profile?.body_build as Build | null) ?? null,
      (profile?.body_volume as Volume | null) ?? null
    ),
    exclude: existing.map((o) => o.prendas),
  };

  let outfits: TripOutfit[];
  try {
    outfits = await generateTripOutfits(genInputs);
    outfits = (await reviewTripOutfits(genInputs, outfits)).outfits;
  } catch {
    return { ok: false, count: existing.length, added: 0 };
  }

  let finalOutfits = outfits;
  let added = outfits.length;
  if (append) {
    const seen = new Set(existing.map(outfitKey));
    const fresh = outfits.filter((o) => !seen.has(outfitKey(o)));
    added = fresh.length;
    finalOutfits = [...existing, ...fresh].slice(0, MAX_LOOKS);
  }

  await supabase
    .from("profiles")
    .update({ capsule_outfits: finalOutfits, capsule_outfits_sig: sig })
    .eq("id", user.id);
  revalidatePath("/closet/capsula/looks");
  return { ok: true, count: finalOutfits.length, added };
}
