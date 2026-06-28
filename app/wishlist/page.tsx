import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeDepth } from "@/lib/colorimetria";
import { goSwatches, subPalette } from "@/lib/palette-data";
import { WishlistClient, type WishlistItem } from "@/components/wishlist/wishlist-client";

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

  // Paleta del usuario para chequear lo que agregue aquí (puede no tenerla aún).
  const season = profile.palette_season;
  const depth = season ? computeDepth(profile.palette_quiz) : null;
  const va = season && depth ? goSwatches(season, depth) : [];
  const evita = season && depth ? subPalette(season, depth).evita : [];

  return (
    <AppShell>
      <WishlistClient items={items} va={va} evita={evita} />
    </AppShell>
  );
}
