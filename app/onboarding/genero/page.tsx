import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { routeForStep } from "@/lib/onboarding";
import { GeneroPicker } from "./genero-picker";

// Primer paso del onboarding: define qué clóset armamos. No lleva barra de
// progreso porque es la antesala (define el resto). Si ya lo elegiste, te
// manda a tu paso actual.
export default async function GeneroPage() {
  const profile = await getProfile();
  if (profile.gender) redirect(routeForStep(profile.onboarding_step));

  return (
    <section className="flex flex-1 flex-col justify-center gap-7 pb-10">
      <div className="flex flex-col gap-3">
        <h1 className="text-[32px] font-bold leading-[1.02] tracking-[-0.025em] text-ink">
          ¿qué ropa{" "}
          <em className="font-display font-normal italic tracking-normal">usas</em>?
        </h1>
        <p className="text-[18px] leading-snug text-muted">
          solo para mostrarte las prendas correctas. tu estilo lo descubrimos
          enseguida.
        </p>
      </div>
      <GeneroPicker />
    </section>
  );
}
