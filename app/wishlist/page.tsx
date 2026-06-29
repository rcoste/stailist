import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { carteraDepth, normSeason } from "@/lib/colorimetria";
import { carteraGoSwatches, carteraPalette } from "@/lib/palette-data";
import { itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";
import {
  WishlistClient,
  type WishlistItem,
  type ClosetPick,
} from "@/components/wishlist/wishlist-client";

// Cartera · Fase 3a — el Wishlist: candidatos que evalúas comprar, con su
// veredicto de color. Server resuelve items (URLs firmadas) + la paleta del
// usuario (para chequear lo que agregue aquí).
export default async function WishlistPage() {
  const profile = await requireOnboarded();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("wishlist_items")
    .select("id, image_path, color_hex, verdict, name, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  const paths = (rows ?? []).map((r) => r.image_path as string);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("prendas").createSignedUrls(paths, 3600);
    data?.forEach((s) => {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    });
  }

  const items: WishlistItem[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    image: signed.get(r.image_path as string) ?? null,
    colorHex: (r.color_hex as string | null) ?? null,
    verdict: (r.verdict as WishlistItem["verdict"]) ?? null,
    name: (r.name as string | null) ?? null,
  }));

  // Prendas del clóset (para combinar en 3c). Resuelve imagen como el clóset.
  const { data: itemRows } = await supabase
    .from("items")
    .select(
      "id, source, photo_path, render_status, render_path, attrs, archetypes(name, image_path)"
    )
    .eq("user_id", profile.id)
    .is("deleted_at", null);
  const itemPriv = Array.from(
    new Set(
      (itemRows ?? [])
        .flatMap((r) => [r.photo_path as string | null, r.render_path as string | null])
        .filter((p): p is string => !!p)
    )
  );
  const itemSigned = new Map<string, string>();
  if (itemPriv.length) {
    const { data } = await supabase.storage.from("prendas").createSignedUrls(itemPriv, 3600);
    data?.forEach((s) => {
      if (s.path && s.signedUrl) itemSigned.set(s.path, s.signedUrl);
    });
  }
  const closet: ClosetPick[] = (itemRows ?? []).map((r) => {
    const arch = r.archetypes as { name?: string } | null;
    const attrs = (r.attrs ?? {}) as { nombre?: string };
    return {
      id: r.id as string,
      nombre: arch?.name ?? attrs.nombre ?? "Prenda",
      image: itemImageUrlSync(r as ItemImageRow, (p) => itemSigned.get(p)),
    };
  });

  // Paleta del usuario para chequear lo que agregue aquí (puede no tenerla aún).
  // Coherente con la Cartera: profundidad del guiño + guiños cuentan como "va".
  const season = normSeason(profile.palette_season);
  const flow = profile.palette_flow;
  const depth = season ? carteraDepth(profile.palette_quiz, season, flow) : null;
  const va = season && depth ? carteraGoSwatches(season, depth, flow) : [];
  const evita = season && depth ? carteraPalette(season, depth, flow).evita : [];

  return (
    <AppShell>
      <WishlistClient items={items} closet={closet} va={va} evita={evita} />
    </AppShell>
  );
}
