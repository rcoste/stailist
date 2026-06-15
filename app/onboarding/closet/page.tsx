import { OnboardingProgress } from "@/components/onboarding-progress";
import { requireStep } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { archetypeImageForGender, type Gender } from "@/lib/archetypes";
import { Checklist, type CatalogItem } from "./checklist";

export default async function ClosetOnboardingPage() {
  const profile = await requireStep(2);

  const supabase = await createClient();
  // Básicos del género elegido + los unisex.
  const { data: catalog } = await supabase
    .from("archetypes")
    .select("id, name, category, attrs, image_path, segment")
    .in("segment", ["unisex", profile.gender ?? "hombre"])
    .order("sort_order");

  // La mujer ve el corte femenino de los básicos unisex.
  const gender = profile.gender as Gender;
  const items: CatalogItem[] = (catalog ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    category: a.category,
    attrs: a.attrs as CatalogItem["attrs"],
    image_path: archetypeImageForGender(a.segment, a.image_path, gender),
  }));

  return (
    <section className="flex flex-1 flex-col gap-6 pt-4">
      <OnboardingProgress step={3} />

      <div className="flex flex-col gap-2">
        <h1 className="text-display font-semibold text-ink">
          ¿Qué tienes en tu clóset?
        </h1>
        <p className="text-base text-muted">
          Marca los básicos que ya tienes — sin fotos, eso viene después si
          quieres.
        </p>
      </div>

      <Checklist catalog={items} />
    </section>
  );
}
