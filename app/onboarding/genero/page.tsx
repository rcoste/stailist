import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { routeForStep } from "@/lib/onboarding";
import { saveGender } from "./actions";

// Primer paso del onboarding: define qué clóset armamos. No lleva barra de
// progreso porque es la antesala (define el resto). Si ya lo elegiste, te
// manda a tu paso actual.
export default async function GeneroPage() {
  const profile = await getProfile();
  if (profile.gender) redirect(routeForStep(profile.onboarding_step));

  const opciones: { value: "mujer" | "hombre"; label: string; desc: string }[] =
    [
      { value: "mujer", label: "Mujer", desc: "Vestidos, faldas, blusas y más" },
      { value: "hombre", label: "Hombre", desc: "Camisas, pantalones, sastre y más" },
    ];

  return (
    <section className="flex flex-1 flex-col gap-6 pt-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-display font-semibold text-ink">
          ¿Qué ropa usas?
        </h1>
        <p className="text-base text-muted">
          Solo para mostrarte las prendas correctas. Tu estilo lo descubrimos
          enseguida.
        </p>
      </div>

      <form action={saveGender} className="flex flex-col gap-3">
        {opciones.map((o) => (
          <button
            key={o.value}
            type="submit"
            name="gender"
            value={o.value}
            className="flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-2xl border border-line bg-surface px-5 py-3 text-left transition-colors duration-200 hover:border-accent focus-visible:border-accent focus-visible:outline-none"
          >
            <span className="text-base font-medium text-ink">{o.label}</span>
            <span className="text-sm text-muted">{o.desc}</span>
          </button>
        ))}
      </form>
    </section>
  );
}
