import { redirect } from "next/navigation";
import { OnboardingProgress } from "@/components/onboarding-progress";
import { getProfile } from "@/lib/auth";
import { ONBOARDING_COMPLETE } from "@/lib/onboarding";
import { PasoAcentos } from "./paso-acentos";

// EL APETITO DE ACENTOS en el onboarding, JUSTO DESPUÉS DEL REVEAL DE COLORES.
// Ahí es donde encaja: la persona acaba de ver qué colores le van, y esta
// pregunta es la otra mitad — cuánto de ese color quiere llevar encima
// (docs/designs/pantalla-apetito-acentos.md).
//
// NO ES UN "STEP" NUMERADO, y es a propósito. Insertar un paso en
// ONBOARDING_ROUTES correría la numeración de todos los siguientes, y quien
// estuviera a media alta —con su onboarding_step ya guardado— aterrizaría en
// otra pantalla al volver. Esta ruta se alcanza desde el reveal y es
// SKIPPABLE: quien la salte se queda con la semilla derivada de sus swipes,
// que no viaja al motor, y siempre puede decidirlo en Perfil → estilo.
//
// El gate es "ya pasó colorimetría" (step ≥ 2), no un step exacto: así
// recargar aquí no te expulsa.
export default async function AcentosPage() {
  const profile = await getProfile();
  if (!profile.gender) redirect("/onboarding/genero");
  if (profile.onboarding_step < 2) redirect("/onboarding/colorimetria");
  if (profile.onboarding_step >= ONBOARDING_COMPLETE) redirect("/hoy");

  return (
    <section className="flex flex-1 flex-col gap-5 pt-4">
      <OnboardingProgress step={2} />

      <div className="flex flex-col gap-1.5">
        <h1 className="text-display font-semibold tracking-[-0.025em] text-ink">
          ¿Y cuánto color te late?
        </h1>
        {/* La pregunta es "¿cuál te PONDRÍAS?", nunca "¿cuál se ve mejor?": son
            varas distintas y aquí importa la segunda — Roberto aprobó un look
            de suéter cobalto que, dijo, no se habría puesto. */}
        {/* Corto a UNA línea a propósito: con dos, el botón de seguir caía
            14px fuera del viewport de 812 y la pantalla pedía scroll para algo
            que se decide de un vistazo (medido en el navegador, no a ojo). */}
        <p className="text-sm text-muted">Ya sé qué colores te van. ¿Cuál de estos te pondrías tú?</p>
      </div>

      <PasoAcentos gender={profile.gender} inicial={profile.acento_apetito} />
    </section>
  );
}
