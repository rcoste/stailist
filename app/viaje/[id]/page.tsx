import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { capsuleRows, type CapsuleOverrides, type CapsuleMatch, type CapsuleTarget } from "@/lib/capsule";
import { loadClosetImageMap } from "@/lib/capsule-data";
import { tripDays, luggageMeta, type Luggage, type TripOutfit, type Occasion } from "@/lib/trip";
import { TripResult, type TripRow } from "@/components/trip-result";
import { TripOutfits, type ResolvedOutfit } from "@/components/trip-outfits";

function fmt(d: string): string {
  const [, m, day] = d.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${Number(day)} ${meses[Number(m) - 1] ?? ""}`;
}

export default async function ViajeDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireOnboarded();
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select(
      "id, lugar, fecha_inicio, fecha_fin, ocasiones, maleta, weather, capsule_target, capsule_match, overrides, empacado, outfits, outfits_stale"
    )
    .eq("id", id)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!trip) notFound();

  const target = trip.capsule_target as CapsuleTarget | null;
  if (!target) {
    return (
      <AppShell>
        <section className="flex flex-col gap-4 pt-4">
          <Link href="/viaje" className="text-sm font-medium text-muted hover:text-ink">
            ← Modo viaje
          </Link>
          <p className="text-sm text-muted">No pude armar esta maleta. Inténtalo otra vez.</p>
        </section>
      </AppShell>
    );
  }

  const match = (trip.capsule_match as CapsuleMatch | null) ?? null;
  const overrides = (trip.overrides as CapsuleOverrides | null) ?? null;
  const empacado = (trip.empacado as Record<string, boolean> | null) ?? {};
  const imageMap = await loadClosetImageMap(supabase, profile.id);

  const rows: TripRow[] = capsuleRows(target, match, overrides).map((r) => ({
    index: r.index,
    nombre: r.item.nombre,
    porque: r.item.porque,
    base: r.base,
    decision: r.decision,
    by: r.by,
    byImage: r.by ? imageMap[r.by] ?? null : null,
  }));

  const days = tripDays(trip.fecha_inicio, trip.fecha_fin);
  const weather = trip.weather as { temp_c: number; condition: string; estimated?: boolean } | null;
  const lug = luggageMeta(trip.maleta as Luggage | null);
  const weatherTxt = weather
    ? weather.estimated
      ? ` · ~${weather.temp_c}°C, clima típico de la temporada`
      : ` · ${weather.temp_c}°C, ${weather.condition}`
    : "";

  // Outfits del viaje (v1.1): resueltos contra el clóset (cada nombre → su imagen).
  const rawOutfits = trip.outfits as TripOutfit[] | null;
  const resolvedOutfits: ResolvedOutfit[] | null = rawOutfits
    ? rawOutfits.map((o) => ({
        ocasion: o.ocasion,
        titulo: o.titulo,
        porque: o.porque,
        tip: o.tip ?? null,
        voto: o.voto ?? null,
        prendas: o.prendas.map((nombre) => ({ nombre, image: imageMap[nombre] ?? null })),
      }))
    : null;

  return (
    <AppShell>
      <section className="flex flex-col gap-5 pt-4">
        <Link href="/viaje" className="text-sm font-medium text-muted hover:text-ink">
          ← Modo viaje
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 font-semibold text-ink">Tu maleta para {trip.lugar}</h1>
          <p className="text-sm text-muted">
            {fmt(trip.fecha_inicio)} – {fmt(trip.fecha_fin)} · {days} días
            {weatherTxt}
            {lug ? ` · ${lug.label.toLowerCase()}` : ""}
          </p>
        </div>

        <TripResult tripId={trip.id} rows={rows} empacado={empacado} />

        <div className="h-px bg-line" />

        <TripOutfits
          tripId={trip.id}
          outfits={resolvedOutfits}
          ocasiones={(trip.ocasiones as Occasion[]) ?? []}
          stale={Boolean(trip.outfits_stale)}
        />
      </section>
    </AppShell>
  );
}
