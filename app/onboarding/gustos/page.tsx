import { OnboardingProgress } from "@/components/onboarding-progress";
import { requireStep } from "@/lib/auth";
import { looksForGender } from "@/lib/looks";
import { SwipeDeck } from "./swipe-deck";

export default async function GustosPage() {
  const profile = await requireStep(0);
  const looks = looksForGender(profile.gender ?? "hombre");

  return (
    <section className="flex flex-1 flex-col gap-6 pt-4">
      <OnboardingProgress step={1} />

      {/* La cabecera se le PASA al deck en vez de pintarse aquí: tiene que
          desaparecer cuando el deck cede el turno a los pares de corte, que
          traen la suya. Pintándola aquí salían dos títulos apilados. */}
      {/* SIN CALIBRACIÓN AQUÍ — Roberto: "las preguntas de afinar tu estilo
          hacen muy largo el on-boarding, las siento muy complejas y siento que
          mucha gente no las entendería; debería ser un paso opcional más
          adelante".
          No se pierden: son LAS MISMAS que pregunta /closet/capsula/editar, que
          ya es un paso del checklist de activación del home. Y el pre-calentado
          de abajo sigue corriendo, así que allá salen instantáneas.
          Lo que se gana: el onboarding pasa de reveal→pares→3 preguntas→colores
          a reveal→pares→colores, justo antes del único paso que paga. */}
      <SwipeDeck
        looks={looks}
        soloPares
        gender={profile.gender ?? "hombre"}
        cabecera={
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
              paso 1 de 5
            </p>
            <h1 className="text-[32px] font-bold leading-[1.02] tracking-[-0.025em] text-ink">
              ¿te gusta o{" "}
              <em className="font-display font-normal italic tracking-normal">no</em>?
            </h1>
            {/* QUÉ HAY QUE HACER Y QUÉ SE GANA — faltaban las dos.
                Roberto, entrando desde cero: "antes de que aparezcan las fotos
                no hay algo que te explique lo que va a pasar; puede ser confuso".
                Cierto: la primera carta aparecía sin decir que se desliza ni
                para qué sirve.
                Va AQUÍ y no en una pantalla de preámbulo a propósito. Un
                prólogo cobra tiempo, no da nada, y anunciar "son 5 pasos" hace
                que se sienta más largo de lo que es — fricción de setup con
                disfraz pedagógico, que es el enemigo declarado del proyecto.
                La barra ya dice cuánto falta; lo que faltaba era qué ganas. */}
            <p className="text-[15px] leading-snug text-muted">
              Dile sí a los looks que te laten y no a los que no — deslizando o
              con los botones. Con esto aprendo tu estilo y en un par de minutos
              te armo tu primer outfit.
            </p>
          </div>
        }
      />
    </section>
  );
}
