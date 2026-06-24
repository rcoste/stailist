import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";
import { HistoryList, type HistoryOutfit } from "./history-list";

export default async function HistorialPage() {
  const profile = await requireOnboarded();
  const supabase = await createClient();

  const { data: outfits } = await supabase
    .from("outfits")
    .select("id, title, explanation, occasion, item_ids, created_at, favorited_at, tryon_path, source")
    .eq("user_id", profile.id)
    // Diarios siempre; los promovidos del viaje solo mientras sigan favoriteados
    // (quitar el favorito los saca del historial sin borrar la fila).
    .or("source.eq.daily,favorited_at.not.is.null")
    .order("created_at", { ascending: false });

  // Resolver prendas (una sola lectura de items) y votos/worn (una de events).
  // Misma resolución de imagen que Hoy/Clóset: arquetipo → render → foto propia →
  // attrs, para que el collage de prendas (fallback sin try-on) muestre los
  // flat-lays reales y no recuadros de color.
  const allItemIds = [
    ...new Set((outfits ?? []).flatMap((o) => o.item_ids as string[])),
  ];
  const [{ data: items }, { data: events }] = await Promise.all([
    allItemIds.length
      ? supabase
          .from("items")
          .select("id, photo_path, render_status, render_path, attrs, archetypes(name, image_path)")
          .in("id", allItemIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    supabase
      .from("events")
      .select("outfit_id, type")
      .eq("user_id", profile.id)
      .in("type", ["vote_up", "vote_down", "worn"]),
  ]);

  // Firmar en un solo batch: el try-on de cada look + los paths privados (render/
  // foto) de las prendas. Los arquetipos son públicos (URL directa, sin firmar).
  const toSign = [
    ...new Set([
      ...(outfits ?? []).map((o) => o.tryon_path as string | null),
      ...(items ?? []).flatMap((i) => [
        i.photo_path as string | null,
        i.render_path as string | null,
      ]),
    ]),
  ].filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (toSign.length > 0) {
    const { data } = await supabase.storage.from("prendas").createSignedUrls(toSign, 3600);
    data?.forEach((s) => {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    });
  }

  const imgById = new Map<string, { nombre: string; swatch: string; imagen: string | null }>(
    (items ?? []).map((i) => {
      const arch = i.archetypes as { name?: string; image_path?: string | null } | null;
      const attrs = (i.attrs ?? {}) as {
        nombre?: string;
        color_hex?: string;
        image_path?: string | null;
      };
      return [
        i.id as string,
        {
          nombre: arch?.name ?? attrs.nombre ?? "Prenda",
          swatch: attrs.color_hex ?? "#E5E1DD",
          imagen: itemImageUrlSync(i as ItemImageRow, (p) => signed.get(p)),
        },
      ];
    })
  );

  const votoByOutfit = new Map<string, "up" | "down">();
  const wornOutfits = new Set<string>();
  for (const ev of events ?? []) {
    if (!ev.outfit_id) continue;
    if (ev.type === "vote_up") votoByOutfit.set(ev.outfit_id, "up");
    else if (ev.type === "vote_down") votoByOutfit.set(ev.outfit_id, "down");
    else if (ev.type === "worn") wornOutfits.add(ev.outfit_id);
  }

  const list: HistoryOutfit[] = (outfits ?? []).map((o) => ({
    id: o.id,
    nombre: o.title ?? "Tu look",
    explicacion: o.explanation,
    createdAt: o.created_at as string,
    fecha: new Date(o.created_at).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
    }),
    occasion: (o.occasion as string | null) ?? null,
    origen: (o.source as string | null) === "viaje" ? "viaje" : "daily",
    tryonImage: o.tryon_path ? signed.get(o.tryon_path as string) ?? null : null,
    prendas: (o.item_ids as string[]).map(
      (id) => imgById.get(id) ?? { nombre: "Prenda", swatch: "#E5E1DD", imagen: null }
    ),
    voto: votoByOutfit.get(o.id) ?? null,
    worn: wornOutfits.has(o.id),
    favorited: !!o.favorited_at,
  }));

  return (
    <AppShell>
      <section className="flex flex-col gap-5 pt-4">
        <div>
          <h1 className="text-h1 font-semibold text-ink">Historial</h1>
          <p className="text-sm text-muted">Tus looks pasados viven aquí.</p>
        </div>

        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-surface px-6 py-14 text-center">
            <p className="editorial text-lg text-ink">tu primer look te espera</p>
            <p className="text-sm text-muted">
              Cuando generes outfits, aquí podrás volver a verlos, votarlos y
              volvértelos a poner.
            </p>
            <Link
              href="/hoy"
              className="flex min-h-12 items-center rounded-sm bg-accent px-6 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
            >
              Genera tu look de hoy
            </Link>
          </div>
        ) : (
          <HistoryList outfits={list} />
        )}
      </section>
    </AppShell>
  );
}
