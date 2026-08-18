import { OnboardingProgress } from "@/components/onboarding-progress";
import { requireStep } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Checklist, type CatalogItem } from "./checklist";

export default async function ClosetOnboardingPage() {
  const profile = await requireStep(2);

  const supabase = await createClient();
  // Solo el subset curado del wow-moment (onboarding_subset). El resto de la
  // biblioteca se agrega después desde el clóset, para no alargar el TTV.
  const { data: catalog } = await supabase
    .from("archetypes")
    .select("id, name, category, attrs, image_path")
    .in("segment", ["unisex", profile.gender ?? "hombre"])
    .eq("onboarding_subset", true)
    // Las retiradas del catálogo (borrado suave, migración 0137) no se ofrecen.
    .is("deleted_at", null)
    .order("sort_order");

  return (
    <section className="flex flex-1 flex-col gap-6 pt-4">
      <OnboardingProgress step={3} />

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          paso 3 de 5
        </p>
        <h1 className="text-[32px] font-bold leading-[1.02] tracking-[-0.025em] text-ink">
          ¿qué{" "}
          <em className="font-display font-normal italic tracking-normal">ya tienes</em>?
        </h1>
        {/* QUÉ SON Y POR QUÉ SE PREGUNTAN.
            Roberto: "debería quedar más claro… explicar que se le mostrarán
            algunos básicos que probablemente ya tenga, para que los añada
            fácil y se pueda hacer el primer look, y que más adelante podrá
            añadir más de la biblioteca o de sus propias fotos".
            Sin esto, la pantalla se lee como un catálogo que hay que llenar
            entero — y son 15 taps justo antes del único momento que paga. */}
        <p className="text-[15px] leading-snug text-muted">
          Son básicos que mucha gente tiene. Marca los tuyos —así de rápido— y
          con eso te armo tu primer outfit. Después le sumas lo demás: de mi
          biblioteca o con fotos de tu propia ropa.
        </p>
      </div>

      <Checklist catalog={(catalog ?? []) as CatalogItem[]} />
    </section>
  );
}
