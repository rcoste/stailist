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

  const supabase = await createClient();

  // Nº real de prendas del clóset — alimenta las frases del "generando"
  // ("revisando tus N prendas…"). head:true → solo cuenta, no trae filas.
  // En paralelo con los outfits guardados (son independientes; sin waterfall).
  const countPromise = supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .is("deleted_at", null);

  let initialOutfits: WowOutfit[] | null = null;
  if (profile.onboarding_step >= 5) {
    const { data: saved } = await supabase
      .from("outfits")
      .select("id, item_ids, title, explanation, tryon_path")
      .eq("user_id", profile.id)
      .is("deleted_at", null)
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
      initialOutfits = await Promise.all(
        saved.reverse().map(async (o) => {
          let tryon: string | null = null;
          if (o.tryon_path) {
            const { data: signed } = await supabase.storage
              .from("prendas")
              .createSignedUrl(o.tryon_path as string, 3600);
            tryon = signed?.signedUrl ?? null;
          }
          return {
            id: o.id,
            nombre: o.title ?? "Tu look",
            explicacion: o.explanation,
            tryon,
            prendas: (o.item_ids as string[]).map((id) => ({
              nombre: attrsById.get(id)?.nombre ?? "Prenda",
              swatch: attrsById.get(id)?.color_hex ?? "#E5E1DD",
              imagen: attrsById.get(id)?.image_path ?? null,
            })),
          };
        })
      );
    }
  }

  return (
    <section className="flex flex-1 flex-col pt-4">
      {/* El chrome (barra de progreso + encabezados) lo controla el cliente por
          estado: en "choosing" muestra "Tus primeros looks", y al elegir uno
          conmuta a "hoy · nombre" (modo Hoy) — sin doble encabezado. */}
      <WowClient
        initialOutfits={initialOutfits}
        userId={profile.id}
        defaultObjective={profile.last_objective}
        hasAvatar={!!profile.avatar_path}
        closetCount={(await countPromise).count ?? 0}
      />
    </section>
  );
}
