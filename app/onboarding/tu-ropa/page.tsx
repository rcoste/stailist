import { redirect } from "next/navigation";
import { enVerComo } from "@/lib/auth";
import { markIntroSeen } from "@/lib/intros";
import { routeForStep, ONBOARDING_COMPLETE } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
import { debeVerTuRopa } from "@/lib/tu-ropa";
import { TuRopaClient } from "./tu-ropa-client";

// "AHORA, CON TU ROPA": entre el primer look y la app (ver lib/tu-ropa.ts).
//
// Vive en /onboarding por el cascarón (logo, sin tabs: todavía es el cierre del
// onboarding) pero FUERA de la zona con etiquetas de publicidad
// (lib/publicidad.ts, ZONA_MEDIDA): aquí se sube una foto de la persona, y el
// wow sale hacia acá con salirSinEtiquetas, igual que antes salía a /hoy.
//
// Se marca vista al mostrarse, no al usarse: se ofrece UNA vez aunque la
// cierren sin tocar nada. Nunca en "ver como": sería el admin gastándole la
// pantalla a otra cuenta.
export default async function TuRopaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_step, hints_seen")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/");
  if ((profile.onboarding_step ?? 0) < ONBOARDING_COMPLETE) redirect(routeForStep(profile.onboarding_step ?? 0));

  const { count } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("source", "photo")
    .is("deleted_at", null);
  const yaVista = !!(profile.hints_seen as Record<string, string> | null)?.["intro:tu-ropa"];
  if (!debeVerTuRopa({ fotosPropias: count ?? 0, yaVista })) redirect("/hoy");

  if (!(await enVerComo())) await markIntroSeen("tu-ropa");

  return <TuRopaClient userId={user.id} />;
}
