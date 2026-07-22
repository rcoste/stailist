import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { routeForStep } from "@/lib/onboarding";
import { EdadPicker } from "./edad-picker";

// Segunda antesala del onboarding (tras el género): rango de edad. Da contexto
// de life-stage al motor y habilita el aviso de menores. Sin barra de progreso
// (es antesala). Si el género no está, de vuelta a género; si la edad ya está,
// al paso actual.
export default async function EdadPage() {
  const profile = await getProfile();
  if (!profile.gender) redirect("/onboarding/genero");
  if (profile.age_range) redirect(routeForStep(profile.onboarding_step));

  return (
    <section className="flex flex-1 flex-col justify-center gap-7 pb-10">
      <div className="flex flex-col gap-3">
        <h1 className="text-[32px] font-bold leading-[1.02] tracking-[-0.025em] text-ink">
          ¿cuántos{" "}
          <em className="font-display font-normal italic tracking-normal">años</em>{" "}
          tienes?
        </h1>
        <p className="font-display text-[18px] leading-snug text-muted">
          nos ayuda a acertarle mejor a tu estilo. nada de fechas exactas, solo
          el rango.
        </p>
      </div>
      <EdadPicker />
    </section>
  );
}
