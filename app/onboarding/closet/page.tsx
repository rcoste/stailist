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
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          paso 3 de 5
        </p>
        <h1 className="text-[32px] font-bold leading-[1.02] tracking-[-0.025em] text-ink">
          ¿qué{" "}
          <em className="font-display font-normal italic tracking-normal">ya tienes</em>?
        </h1>
      </div>

      <Checklist catalog={(catalog ?? []) as CatalogItem[]} />
    </section>
  );
}
