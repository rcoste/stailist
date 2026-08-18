import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BasicosClient, type BasicoRow } from "./basicos-client";

// QUÉ BÁSICOS VE UN USUARIO NUEVO EN "¿QUÉ YA TIENES?".
//
// Roberto: "me gustaría tener un módulo en el admin donde pueda añadir o quitar
// las prendas que se muestran en la sección de que ya tienes".
//
// Manda sobre `archetypes.onboarding_subset`, la misma columna que filtra
// /onboarding/closet — no hay lista paralela.
//
// LO QUE ESTA PANTALLA MIDE Y EL CATÁLOGO NO: el total de prendas prendidas NO
// es lo que ve nadie. El onboarding pide `segment in (unisex, su género)`, así
// que un hombre ve unisex+hombre y una mujer ve unisex+mujer. Prender diez
// prendas de mujer no le cambia nada a él. Por eso arriba van los DOS números
// reales en vez del total, que sería el dato bonito y equivocado.

export const dynamic = "force-dynamic";

export default async function BasicosPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("archetypes")
    .select("id, name, category, segment, attrs, image_path, onboarding_subset")
    // Una prenda retirada no se puede meter al onboarding: el toggle la
    // marcaría y la pantalla no la mostraría nunca (migración 0137).
    .is("deleted_at", null)
    .order("segment")
    .order("sort_order");

  const filas = (data ?? []) as BasicoRow[];
  const cuenta = (g: "hombre" | "mujer") =>
    filas.filter(
      (f) => f.onboarding_subset && (f.segment === "unisex" || f.segment === g)
    ).length;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 font-semibold text-ink">Básicos del onboarding</h1>
        <p className="text-sm text-muted">
          Lo que ve alguien nuevo en <strong>&ldquo;¿qué ya tienes?&rdquo;</strong>. Es el
          último paso antes de su primer outfit: cada prenda de más es un tap de
          más justo donde la gente se cae.
        </p>
      </div>

      <div className="flex gap-3">
        {(["hombre", "mujer"] as const).map((g) => (
          <div
            key={g}
            className="flex flex-1 flex-col gap-1 rounded-xl border border-line bg-surface p-4"
          >
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Ve {g === "hombre" ? "un hombre" : "una mujer"}
            </span>
            <span className="text-h1 font-semibold text-ink">{cuenta(g)}</span>
            <span className="text-xs text-muted">
              unisex + {g} · la spec dice ~15
            </span>
          </div>
        ))}
      </div>

      <BasicosClient filas={filas} />
    </section>
  );
}
