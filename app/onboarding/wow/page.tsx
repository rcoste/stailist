import { OnboardingProgress } from "@/components/onboarding-progress";
import { getProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { routeForStep } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
import { WowClient, type WowOutfit } from "./wow-client";

// El momento wow: 2-3 outfits generados con tu clóset, tus gustos y tu paleta.
// Acepta step 4 (recién terminó checklist) Y step 5 (la generación lo cerró
// mientras seguía en esta pantalla votando) — un reload no debe expulsarla
// a /hoy a media votación, pero pasos anteriores sí redirigen.
// Con step 5 NO se regenera: se muestran los outfits ya guardados (cada
// generación cuesta dinero; recargar la página no debe disparar otra).
export default async function WowPage() {
  const profile = await getProfile();
  if (profile.onboarding_step < 4) {
    redirect(routeForStep(profile.onboarding_step));
  }

  let initialOutfits: WowOutfit[] | null = null;
  if (profile.onboarding_step >= 5) {
    const supabase = await createClient();
    const { data: saved } = await supabase
      .from("outfits")
      .select("id, item_ids, title, explanation")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(3);
    if (saved && saved.length > 0) {
      const itemIds = [...new Set(saved.flatMap((o) => o.item_ids as string[]))];
      const { data: items } = await supabase
        .from("items")
        .select("id, attrs")
        .in("id", itemIds);
      const attrsById = new Map(
        (items ?? []).map((i) => [
          i.id,
          i.attrs as {
            nombre?: string;
            color_hex?: string;
            image_path?: string | null;
          },
        ])
      );
      initialOutfits = saved.reverse().map((o) => ({
        id: o.id,
        nombre: o.title ?? "Tu look",
        explicacion: o.explanation,
        prendas: (o.item_ids as string[]).map((id) => ({
          nombre: attrsById.get(id)?.nombre ?? "Prenda",
          swatch: attrsById.get(id)?.color_hex ?? "#E5E1DD",
          imagen: attrsById.get(id)?.image_path ?? null,
        })),
      }));
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-6 pt-4">
      <OnboardingProgress step={5} />

      <div className="flex flex-col gap-2">
        <h1 className="text-display font-semibold text-ink">
          Tus primeros looks
        </h1>
        <p className="text-base text-muted">
          Armados con tu clóset, tus gustos y tus colores.
        </p>
      </div>

      <WowClient initialOutfits={initialOutfits} />
    </section>
  );
}
