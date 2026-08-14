import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth";
import { CapsulaForm } from "@/app/closet/capsula/capsula-form";
import { assessmentQuestions, type LifestyleAnswers } from "@/lib/capsule";
import { createClient } from "@/lib/supabase/server";
import { ensureStyleQuestions } from "@/lib/style-questions-cache";
import { EsencialesGate } from "@/components/esenciales-intro";

// La acción saveLifestyle (2 llamadas a Opus, ~27s) se dispara desde esta página, y
// la primera vez también se generan las preguntas de estilo personalizadas (~1 Opus).
// Armar la cápsula es 1 llamada larga a Opus (~40s típico, más con un perfil
// rico). Con el tope en 60 se cortaba a la mitad y devolvía 504 (le pasó a
// Roberto). 300s es el máximo actual de la plataforma — el usuario no espera
// tanto en la práctica; esto es red de seguridad, no el caso normal.
export const maxDuration = 300;

export default async function EditarCapsulaPage() {
  const profile = await requireOnboarded();
  const initial = (profile.lifestyle as LifestyleAnswers | null) ?? {};

  // Preguntas personalizadas (IA, cacheadas): fijas + las de SU estilo.
  const supabase = await createClient();
  const extra = await ensureStyleQuestions(supabase, profile);
  const questions = [...assessmentQuestions(profile.gender), ...extra];

  // Primera vez de verdad (sin cápsula Y sin haber visto esta explicación):
  // antes de las preguntas, QUÉ se está creando — sin ella, quien llega de
  // /closet/capsula cae directo a un cuestionario sin contexto (pedido de
  // Roberto, 2026-08-13). Quien rearma su cápsula no la ve. La llave es la de
  // la previa, no la de la lista: son dos momentos con crédito propio.
  const primeraVez =
    !profile.capsule_target && !profile.hints_seen?.["intro:esenciales-previa"];

  // Sin tab bar: el cuestionario tiene su propia barra de acción fija (Atrás /
  // Siguiente) — CTA y tab bar no coexisten. La intro previa trae su propia
  // salida ("ahora no"), porque reemplaza al form y con él al "Atrás".
  return (
    <AppShell hideTabBar>
      <section className="pt-1">
        <EsencialesGate vista={!primeraVez} modo="previa">
          <CapsulaForm initial={initial} questions={questions} />
        </EsencialesGate>
      </section>
    </AppShell>
  );
}
