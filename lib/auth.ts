import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ONBOARDING_COMPLETE, routeForStep } from "@/lib/onboarding";
import type {
  CapsuleMatch,
  CapsuleOverrides,
  CapsuleTarget,
  LifestyleAnswers,
} from "@/lib/capsule";
import type { JourneyState } from "@/lib/journey";

export type Gender = "hombre" | "mujer";

export type Profile = {
  id: string;
  email: string;
  gender: Gender | null;
  taste_tags: string[];
  palette_season: "primavera" | "verano" | "otono" | "invierno" | null;
  palette_flow: "primavera" | "verano" | "otono" | "invierno" | null;
  palette_quiz: Record<string, string> | null;
  last_objective: string | null;
  onboarding_step: number;
  city: string | null;
  is_admin: boolean;
  lifestyle: LifestyleAnswers | null;
  capsule_target: CapsuleTarget | null;
  capsule_match: CapsuleMatch | null;
  capsule_overrides: CapsuleOverrides | null;
  avatar_path: string | null;
  body_type: "slim" | "athletic" | "average" | "full" | null;
  body_build: "delgada" | "media" | "curvas" | null;
  body_volume: "arriba" | "cintura" | "abajo" | "medio" | "pareja" | null;
  style_vetoes: { chips: string[]; free: string[] };
  journey_state: JourneyState;
  style_archetype: { nombre: string; descripcion: string } | null;
};

// Usuario autenticado + su profile. El proxy ya filtra a los no autenticados;
// esto es el cinturón además de los tirantes (y nos da el profile tipado).
export async function getProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");
  return profile as Profile;
}

// Para Hoy/Clóset/Historial: exige onboarding completo; si no, retoma donde iba.
export async function requireOnboarded(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile.gender) redirect("/onboarding/genero");
  if (profile.onboarding_step < ONBOARDING_COMPLETE) {
    redirect(routeForStep(profile.onboarding_step));
  }
  return profile;
}

// Para cada pantalla de onboarding: si no es tu paso actual, te manda al tuyo
// (cubre retomar tras interrupción y evita saltarse pasos por URL). El género
// es lo primero: sin él, a la pantalla de género antes que nada.
export async function requireStep(step: number): Promise<Profile> {
  const profile = await getProfile();
  if (!profile.gender) redirect("/onboarding/genero");
  if (profile.onboarding_step !== step) {
    redirect(routeForStep(profile.onboarding_step));
  }
  return profile;
}

// Para /admin: solo Roberto (is_admin). El resto, fuera a la app normal.
export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile.is_admin) redirect("/");
  return profile;
}
