import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssessmentQuestion } from "@/lib/capsule";
import type { Profile } from "@/lib/auth";
import { generateStyleQuestions } from "@/lib/engine/style-questions";
import { seasonDisplayLabel } from "@/lib/colorimetria";
import { buildLabel, volumeLabel } from "@/lib/silueta";

// Firma del estilo: si cambia el arquetipo o los gustos, las preguntas se regeneran.
// v-prefix: súbelo cuando cambie el prompt/formato del generador para invalidar las
// preguntas cacheadas y regenerarlas. v2 = reencuadre "lo que te atrae" + opción
// "Aún no lo sé".
// v3 = prohibido el color (era 9 de 12 preguntas; el color es del paso de
// colorimetría). Sube la versión para tirar las cacheadas, que son de esa tanda.
const QUESTIONS_VERSION = "v3";

export function styleQuestionsSig(p: {
  style_archetype: { nombre: string } | null;
  taste_tags: string[] | null;
}): string {
  const arch = p.style_archetype?.nombre ?? "none";
  return `${QUESTIONS_VERSION}|${arch}|${[...(p.taste_tags ?? [])].sort().join(",")}`;
}

// Devuelve las preguntas de estilo personalizadas (cacheadas en el perfil); las
// genera con IA la primera vez o cuando el estilo cambió. No bloquea: si la
// generación falla, devuelve lo cacheado (o vacío) y el assessment sigue con las
// preguntas fijas.
export async function ensureStyleQuestions(
  supabase: SupabaseClient,
  profile: Profile
): Promise<AssessmentQuestion[]> {
  const sig = styleQuestionsSig(profile);
  const cached = profile.style_questions;
  if (cached?.sig === sig && Array.isArray(cached.questions)) return cached.questions;
  if (!profile.style_archetype) return [];

  let questions: AssessmentQuestion[] = [];
  try {
    questions = await generateStyleQuestions({
      archetype: profile.style_archetype,
      tasteTags: profile.taste_tags ?? [],
      gender: profile.gender,
      paletaLabel: profile.palette_season
        ? seasonDisplayLabel(profile.palette_season, profile.palette_flow)
        : null,
      siluetaLabel:
        [
          profile.body_build ? buildLabel(profile.body_build) : null,
          profile.body_volume ? volumeLabel(profile.body_volume) : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
    });
  } catch {
    return cached?.questions ?? [];
  }
  if (questions.length) {
    await supabase
      .from("profiles")
      .update({ style_questions: { sig, questions } })
      .eq("id", profile.id);
  }
  return questions;
}
