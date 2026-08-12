"use server";

import { createClient } from "@/lib/supabase/server";

// Acciones compartidas sobre un outfit (las usan el wow, el historial y Hoy).

// Voto 👍/👎 persistente. El índice único (user, outfit, type) hace el doble
// tap idempotente; si cambia de opinión, borramos el voto contrario.
export async function voteOutfit(
  outfitId: string,
  up: boolean
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const voteType = up ? "vote_up" : "vote_down";
  const opposite = up ? "vote_down" : "vote_up";

  await supabase
    .from("events")
    .delete()
    .eq("user_id", user.id)
    .eq("outfit_id", outfitId)
    .eq("type", opposite);

  const { error } = await supabase.from("events").insert({
    user_id: user.id,
    outfit_id: outfitId,
    type: voteType,
    data: {},
  });

  // 23505 = ya había votado igual (doble tap) — cuenta como éxito.
  if (error && error.code !== "23505") return { ok: false };
  return { ok: true };
}

// markWorn() vivía aquí y se borró en el rediseño del home (2026-08-11): su
// único llamador era la card "¿te lo pusiste ayer?", que murió con él. El
// evento `worn` NO desapareció —lo siguen leyendo el motor, el clóset y el
// admin— pero ahora lo escribe quien tiene la prueba: el fit check, al recibir
// la foto del outfit puesto (app/api/espejo/route.ts). Si algún día hace falta
// marcar `worn` desde un botón otra vez, esta función está en el historial de
// git; no la revivas por inercia sin una superficie que la llame.

// "Ponérmelo" (re-wear): vuelve a poner un look pasado como el look del día de
// HOY. Limpia el flag del look de hoy anterior (respeta el índice único parcial
// (user, look_date) where is_look_of_day) y marca este outfit como el de hoy.
// NO marca "worn": volver a elegir un look no es habérselo puesto. La evidencia
// de que sí se lo puso llega por otro lado — desde el rediseño del home
// (2026-08-11) ya no hay una card que lo pregunte, sino el fit check (la foto
// del outfit puesto) y la señal de oro por cercanía (lib/senal-oro).
// Tras esto, el cliente navega a /hoy.
export async function wearToday(
  outfitId: string,
  /** Fecha calendario LOCAL del dispositivo (YYYY-MM-DD). El server corre en
   *  UTC — sin esto, "ponérmelo hoy" a las 7pm de CDMX caía en mañana. */
  fechaLocal?: string
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // La local si viene y es sana (±3 días del reloj del server); si no, la UTC.
  const sana =
    typeof fechaLocal === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(fechaLocal) &&
    Math.abs(new Date(fechaLocal + "T12:00:00Z").getTime() - Date.now()) < 3 * 86_400_000;
  const today = sana ? fechaLocal! : new Date().toISOString().slice(0, 10);

  // 1) El look de hoy actual deja de serlo (sigue en historial por su created_at).
  await supabase
    .from("outfits")
    .update({ is_look_of_day: false })
    .eq("user_id", user.id)
    .eq("is_look_of_day", true)
    .eq("look_date", today);

  // 2) Este look pasa a ser el de hoy. created_at no cambia → en el historial
  // sigue agrupado en su mes original; solo lo "revivimos" en Hoy.
  const { error } = await supabase
    .from("outfits")
    .update({ is_look_of_day: true, look_date: today })
    .eq("id", outfitId)
    .eq("user_id", user.id);

  return { ok: !error };
}

// Guarda la razón del 👎 (pill o texto abierto) en el evento del voto. Es el
// ground truth para calibrar el juez de styling — etiqueta humana de por qué un
// look no va, en vez de adivinar con reglas.
export async function saveDownReason(
  outfitId: string,
  reason: string
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("events")
    .update({ data: { reason: reason.slice(0, 200) } })
    .eq("user_id", user.id)
    .eq("outfit_id", outfitId)
    .eq("type", "vote_down");

  return { ok: !error };
}

// "Otro look": guarda por qué este no convenció (chip opcional). Es señal
// negativa con etiqueta — donde el motor falló — para calibrar el juez. No
// bloquea: si el usuario no elige nada, no se guarda y el look se regenera igual.
export async function saveSkipReason(
  outfitId: string,
  reason: string
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase.from("events").insert({
    user_id: user.id,
    outfit_id: outfitId,
    type: "another_look",
    data: { reason: reason.slice(0, 200) },
  });

  if (error && error.code !== "23505") return { ok: false };
  return { ok: true };
}

// Bookmark: guarda/quita un look de favoritos (distinto del 👍). Sella o limpia
// outfits.favorited_at del look del propio usuario (RLS).
export async function toggleFavorite(
  outfitId: string,
  favorite: boolean
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("outfits")
    .update({ favorited_at: favorite ? new Date().toISOString() : null })
    .eq("id", outfitId)
    .eq("user_id", user.id);

  return { ok: !error };
}
