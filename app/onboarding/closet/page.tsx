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
    .order("sort_order");

  return (
    <section className="flex flex-1 flex-col gap-6 pt-4">
      <OnboardingProgress step={3} />

      <div className="flex flex-col gap-2">
        <h1 className="text-display font-semibold text-ink">
          ¿Qué tienes en tu clóset?
        </h1>
        <p className="text-base text-muted">
          Marca los básicos que ya tienes — sin fotos, eso viene después si
          quieres. Esto es una muestra; luego podrás agregar más desde tu clóset.
        </p>
      </div>

      <Checklist catalog={(catalog ?? []) as CatalogItem[]} />
    </section>
  );
}
