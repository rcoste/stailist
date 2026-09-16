import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { routeForStep } from "@/lib/onboarding";
import { ConocioPicker } from "./conocio-picker";

// Tercera antesala (tras género y edad): "¿cómo nos conociste?". Sin barra de
// progreso, como las otras dos. NO es un candado: requireStep no la exige, así
// que quien ya iba a media alta cuando esto salió no la ve nunca, y quien la
// salta queda como 'omitido' para no volver a preguntarle. Se llega aquí sólo
// desde la acción de edad (app/onboarding/edad/actions.ts).
export default async function ConocioPage() {
  const profile = await getProfile();
  if (!profile.gender) redirect("/onboarding/genero");
  if (!profile.age_range) redirect("/onboarding/edad");
  if (profile.como_nos_conocio) redirect(routeForStep(profile.onboarding_step));

  return (
    <section className="flex flex-1 flex-col justify-center gap-7 pb-10">
      <div className="flex flex-col gap-3">
        <h1 className="text-[32px] font-bold leading-[1.02] tracking-[-0.025em] text-ink">
          ¿cómo nos{" "}
          <em className="font-display font-normal italic tracking-normal">conociste</em>?
        </h1>
        <p className="text-[18px] leading-snug text-muted">
          un toque y seguimos. nos ayuda a saber dónde encontrar a más gente como tú.
        </p>
      </div>
      <ConocioPicker />
    </section>
  );
}
