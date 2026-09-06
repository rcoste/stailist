import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ONBOARDING_COMPLETE, routeForStep } from "@/lib/onboarding";
import type {
  AssessmentQuestion,
  CapsuleMatch,
  CapsuleOverrides,
  CapsuleSwaps,
  CapsuleTarget,
  LifestyleAnswers,
} from "@/lib/capsule";
import type { JourneyState } from "@/lib/journey";
import type { AgeRange } from "@/lib/edad";
import type { Build, Volume } from "@/lib/silueta";

export type Gender = "hombre" | "mujer";

export type Profile = {
  id: string;
  email: string;
  gender: Gender | null;
  // Rango de edad declarado (tras el género). Contexto de life-stage para el
  // motor + gate del aviso de menores. Ver lib/edad.ts.
  age_range: AgeRange | null;
  /** 'semanal' | 'off' — opt-in del correo (B2). select("*") lo trae. */
  email_semanal: string | null;
  // Sello de que el menor DECLARÓ tener permiso (check del onboarding).
  minor_ack_at: string | null;
  // Consentimiento parental VERIFICADO: correo del tutor + token del link +
  // cuándo confirmó. Sin verified, las fotos del menor quedan bloqueadas.
  minor_parent_email: string | null;
  minor_consent_token: string | null;
  minor_consent_verified_at: string | null;
  // Último envío del correo al tutor (cooldown de reenvío + feedback en la card).
  minor_consent_last_sent_at: string | null;
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
  capsule_swaps: CapsuleSwaps | null; // overlay de rechazos/alternativas (issue #89)
  capsule_outfits: unknown[] | null; // looks armados con lo que tienes de la cápsula
  capsule_outfits_sig: string | null; // firma del clóset cuando se generaron
  avatar_path: string | null;
  created_at: string;
  // Hints contextuales ya vistos: { "<hint_id>": "<iso>" } (ver lib/hints.ts).
  hints_seen: Record<string, string>;
  body_type: "slim" | "athletic" | "average" | "full" | null;
  // Atados a lib/silueta (única fuente): antes eran uniones literales copiadas
  // que solo listaban los ids de MUJER — los de hombre ya se guardaban en la DB
  // pero el tipo los desconocía. Al derivarlos, no se pueden volver a desfasar.
  body_build: Build | null;
  body_volume: Volume | null;
  style_vetoes: { chips: string[]; free: string[] };
  /** Dial de registro por plan (lib/registro-plan.ts): default consenso. */
  registro_por_plan: import("@/lib/registro-plan").RegistroPorPlan | null;
  /** Cuánto color quiere llevar (lib/looks.ts). `fuente` distingue la semilla
   *  derivada de los swipes de lo que la persona eligió: elegido nunca se pisa. */
  acento_apetito: import("@/lib/looks").ApetitoAcentos | null;
  acento_apetito_fuente: "swipes" | "elegido" | null;
  journey_state: JourneyState;
  style_archetype: { nombre: string; descripcion: string } | null;
  // Preguntas de estilo personalizadas (IA) cacheadas: { sig, questions }. sig = firma
  // del estilo; si cambia, se regeneran. Afinan el assessment de la cápsula.
  style_questions: { sig: string; questions: AssessmentQuestion[] } | null;
  // Estilo de referencia (1-3 fotos de un estilo que le gusta): resumen + tags
  // (inspiran el vibe de la generación), veredicto de fit (pushback) e imágenes en
  // bucket privado. `image_path` es el shape viejo (una sola foto).
  style_reference: {
    summary: string;
    tags: string[];
    fit?: { verdict: string; note: string } | null;
    image_paths?: string[];
    image_path?: string;
  } | null;
  // Su estilo EN SUS PALABRAS (texto libre opcional del perfil, ≤280 chars).
  style_words: string | null;
  /**
   * Cómo se viste para trabajar. Se pregunta la primera vez que elige la
   * ocasión "trabajo", no en el onboarding: quien nunca la use no paga nada.
   * null = todavía sin preguntar.
   */
  work_dress_code: string | null;
};

// Cookie del modo "ver como" (admin ve la app con los datos de otro usuario,
// solo lectura). La pone/quita /admin/ver-como/*; el proxy bloquea todo POST
// mientras exista, así que ninguna pantalla puede mutar datos en este modo.
export const VIEW_AS_COOKIE = "admin_view_as";

// Usuario autenticado + su profile. El proxy ya filtra a los no autenticados;
// esto es el cinturón además de los tirantes (y nos da el profile tipado).
export async function getProfile(opts?: { real?: boolean }): Promise<Profile> {
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

  // "Ver como": si un admin trae la cookie, las pantallas de la app cargan el
  // perfil del usuario objetivo en vez del propio (las lecturas pasan por las
  // policies "admin reads *"). /admin usa { real: true } para seguir operando
  // como el admin real aunque la cookie exista.
  if (!opts?.real && profile.is_admin) {
    const viewAs = (await cookies()).get(VIEW_AS_COOKIE)?.value;
    if (viewAs && viewAs !== user.id) {
      const { data: target } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", viewAs)
        .single();
      if (target) return target as Profile;
    }
  }
  return profile as Profile;
}

// Para Hoy/Clóset/Historial: exige onboarding completo; si no, retoma donde iba.
// ¿Modo "ver como" activo? El gate de edad no aplica ahí: es solo-lectura (el
// proxy bloquea todo POST, saveAge incluido) y los perfiles pre-migración
// tienen edad vacía — sin la exención el admin quedaría atrapado en /edad.
// La cookie sola NO basta: un usuario podría ponérsela a mano para saltarse la
// pantalla de edad — se exige que el usuario REAL sea admin (query extra solo
// cuando la cookie existe, i.e. sesiones de admin).
async function enVerComo(): Promise<boolean> {
  if (!(await cookies()).get(VIEW_AS_COOKIE)?.value) return false;
  const real = await getProfile({ real: true });
  return real.is_admin;
}

export async function requireOnboarded(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile.gender) redirect("/onboarding/genero");
  if (!profile.age_range && !(await enVerComo())) redirect("/onboarding/edad");
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
  if (!profile.age_range && !(await enVerComo())) redirect("/onboarding/edad");
  if (profile.onboarding_step !== step) {
    redirect(routeForStep(profile.onboarding_step));
  }
  return profile;
}

// Para /admin: solo Roberto (is_admin). El resto, fuera a la app normal.
// { real: true }: /admin siempre opera como el admin real, aunque el modo
// "ver como" esté activo (si no, la cookie te sacaría de tu propio admin).
export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile({ real: true });
  if (!profile.is_admin) redirect("/");
  return profile;
}
