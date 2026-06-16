import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HistoryList, type HistoryOutfit } from "./history-list";

export default async function HistorialPage() {
  const profile = await requireOnboarded();
  const supabase = await createClient();

  const { data: outfits } = await supabase
    .from("outfits")
    .select("id, title, explanation, item_ids, created_at, favorited_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  // Resolver prendas (una sola lectura de items) y votos/worn (una de events).
  const allItemIds = [
    ...new Set((outfits ?? []).flatMap((o) => o.item_ids as string[])),
  ];
  const [{ data: items }, { data: events }] = await Promise.all([
    allItemIds.length
      ? supabase.from("items").select("id, attrs").in("id", allItemIds)
      : Promise.resolve({ data: [] as { id: string; attrs: unknown }[] }),
    supabase
      .from("events")
      .select("outfit_id, type")
      .eq("user_id", profile.id)
      .in("type", ["vote_up", "vote_down", "worn"]),
  ]);

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
    fecha: new Date(o.created_at).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
    }),
    prendas: (o.item_ids as string[]).map((id) => ({
      nombre: attrsById.get(id)?.nombre ?? "Prenda",
      swatch: attrsById.get(id)?.color_hex ?? "#E5E1DD",
      imagen: attrsById.get(id)?.image_path ?? null,
    })),
    voto: votoByOutfit.get(o.id) ?? null,
    worn: wornOutfits.has(o.id),
    favorited: !!o.favorited_at,
  }));

  return (
    <AppShell>
      <section className="flex flex-col gap-6 pt-4">
        <div>
          <h1 className="text-h1 font-semibold text-ink">Historial</h1>
          <p className="text-sm text-muted">Tus looks pasados viven aquí.</p>
        </div>

        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-surface px-6 py-14 text-center">
            <p className="editorial text-lg text-ink">tu primer look te espera</p>
            <p className="text-sm text-muted">
              Cuando generes outfits, aquí podrás volver a verlos, votarlos y
              marcar los que te pusiste.
            </p>
            <Link
              href="/hoy"
              className="flex min-h-12 items-center rounded-full bg-accent px-6 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
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
