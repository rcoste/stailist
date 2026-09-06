"use server";

import { createClient } from "@/lib/supabase/server";
import { registrarEvento } from "@/lib/telemetria";

// Intros de módulo: la explicación que se muestra UNA vez, la primera vez que
// pisas una superficie cuyo CONCEPTO no es obvio.
//
// No son hints. Un hint señala un botón en una línea ("¿no te convence? dímelo
// y te cambio la pieza"); una intro enseña una idea que la persona no tenía
// ("pocas piezas que combinan entre sí rinden más que un clóset lleno"). Por eso
// no viven en hints-catalog: ése exige que cada id tenga un elemento al que
// apuntar, y una intro no apunta a nada — ES la pantalla.
//
// Se persisten en el MISMO `profiles.hints_seen`, con prefijo `intro:`. Así
// "volver a ver los tips" del Perfil también las reinicia, que es justo lo que
// alguien espera de ese botón.

// "esenciales" = al ver la lista ya armada (habla de SUS piezas).
// "esenciales-previa" = antes del cuestionario (qué vas a crear y para qué).
// Son dos ids y no uno porque marcan momentos distintos: si compartieran
// crédito, quien abandona el quiz a media pregunta —probable, quedan ~7 más y
// ~40s de generación— llegaría después a su lista de 30 prendas sin ninguna
// explicación, que es justo lo que la intro existe para evitar.
export type IntroId = "esenciales" | "esenciales-previa";

// OJO: este archivo es "use server" — aquí SOLO se pueden exportar funciones
// async. Un lector puro (`introVista(hints, id)`) que ahorraría a las páginas
// armar `intro:<id>` a mano tendría que vivir en un módulo aparte; anotado en
// TODOS.md en vez de crear un archivo a mitad de un ship.
const KEY = (id: IntroId) => `intro:${id}`;

export async function markIntroSeen(id: IntroId): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("hints_seen")
    .eq("id", user.id)
    .single();
  const seen = (profile?.hints_seen as Record<string, string> | null) ?? {};
  if (seen[KEY(id)]) return; // idempotente
  seen[KEY(id)] = new Date().toISOString();

  await supabase.from("profiles").update({ hints_seen: seen }).eq("id", user.id);
  // Para medir en el admin si la explicación se lee o se salta.
  await registrarEvento(supabase, { user_id: user.id, type: "intro_seen", data: { id } });
}
