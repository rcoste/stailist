import { OnboardingProgress } from "@/components/onboarding-progress";
import { requireStep } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Checklist, type CatalogItem } from "./checklist";

export default async function ClosetOnboardingPage() {
  await requireStep(3);

  const supabase = await createClient();
  const { data: catalog } = await supabase
    .from("archetypes")
    .select("id, name, category, attrs")
    .order("sort_order");

  return (
    <section className="flex flex-1 flex-col gap-6 pt-4">
      <OnboardingProgress step={4} />

      <div className="flex flex-col gap-2">
        <h1 className="text-display font-semibold text-ink">
          ¿Qué tienes en tu clóset?
        </h1>
        <p className="text-base text-muted">
          Marca los básicos que ya tienes — sin fotos, eso viene después si
          quieres.
        </p>
      </div>

      <Checklist catalog={(catalog ?? []) as CatalogItem[]} />
    </section>
  );
}
