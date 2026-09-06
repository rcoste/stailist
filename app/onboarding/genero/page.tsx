import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { routeForStep } from "@/lib/onboarding";
import { GeneroPicker } from "./genero-picker";
import { registrarEvento } from "@/lib/telemetria";
import { createClient } from "@/lib/supabase/server";

// Primer paso del onboarding: define qué clóset armamos. No lleva barra de
// progreso porque es la antesala (define el resto). Si ya lo elegiste, te
// manda a tu paso actual.
export default async function GeneroPage() {
  const profile = await getProfile();
  if (profile.gender) redirect(routeForStep(profile.onboarding_step));

  // AQUÍ ARRANCA EL RELOJ DEL TTV. Es la primera pantalla que la persona ve
  // después de teclear el código; escribir en un GET es raro, pero el hecho que
  // se mide es justamente "abrió la app". Idempotente: sólo la primera vez.
  const supabase = await createClient();
  const { data: arrancado } = await supabase
    .from("profiles")
    .update({ onboarding_started_at: new Date().toISOString() })
    .eq("id", profile.id)
    .is("onboarding_started_at", null)
    .select("id");
  if (arrancado && arrancado.length > 0) {
    await registrarEvento(supabase, { user_id: profile.id, type: "onboarding_started" });
  }

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
