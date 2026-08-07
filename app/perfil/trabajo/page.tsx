import Link from "next/link";
import { requireOnboarded } from "@/lib/auth";
import { returnLabel, safeReturn } from "@/lib/return-to";
import { ASSESSMENT_QUESTIONS } from "@/lib/capsule";
import { TrabajoClient } from "./trabajo-client";

// Cambiar cómo te vistes para trabajar.
//
// La pregunta del wizard se hace UNA sola vez (es un dato de persona, no de
// día), así que sin esta pantalla una respuesta equivocada era permanente. Y
// además el comparador corre sobre el perfil de quien califica: sin el dato,
// los briefs de trabajo se generan sin calibrar y no prueban nada. Lo cachó
// Roberto antes de lanzar el veredicto nuevo.
export default async function PerfilTrabajoPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  const profile = await requireOnboarded();
  const { return: ret } = await searchParams;
  const returnTo = safeReturn(ret);

  // Lo que ya contestó en el quiz de estilo de vida. Se muestra para que la
  // pregunta no se sienta repetida: aquella describe la FORMA de su semana
  // (multi: oficina, remoto, estudio) y esta el REGISTRO de su ropa. La
  // distinción es justo la que faltaba — "oficina creativa o casual" no dice
  // si eso es camisa sin saco o jeans y camiseta.
  const life = (profile.lifestyle ?? {}) as Record<string, string>;
  const q = ASSESSMENT_QUESTIONS.find((x) => x.id === "trabajo");
  const desdeElQuiz =
    (life.trabajo ?? "")
      .split(",")
      .map((v) => q?.options.find((o) => o.value === v)?.label.toLowerCase())
      .filter(Boolean)
      .join(" / ") || null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-bg px-4 py-4">
      <Link href={returnTo} className="text-sm font-medium text-muted hover:text-ink">
        ← {returnLabel(returnTo)}
      </Link>
      <div className="mt-4">
        <TrabajoClient
          actual={profile.work_dress_code}
          gender={profile.gender}
          desdeElQuiz={desdeElQuiz}
          returnTo={returnTo}
        />
      </div>
    </div>
  );
}
