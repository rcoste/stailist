import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { capsuleRows, type CapsuleOverrides, type CapsuleMatch, type CapsuleTarget } from "@/lib/capsule";
import { loadClosetImageMap } from "@/lib/capsule-data";
import { tripDays, luggageMeta, type Luggage, type TripOutfit, type Occasion } from "@/lib/trip";
import { TripResult, type TripRow } from "@/components/trip-result";
import { TripOutfits, type ResolvedOutfit } from "@/components/trip-outfits";
import { TripTabs } from "@/components/trip-tabs";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmt(d: string): string {
  const [, m, day] = d.split("-");
  return `${Number(day)} ${MESES[Number(m) - 1] ?? ""}`;
}
// "17 – 24 nov" (mismo mes) o "28 nov – 3 dic" (distinto).
function rango(i: string, f: string): string {
  const [, mi, di] = i.split("-");
  const [, mf, df] = f.split("-");
  if (mi === mf) return `${Number(di)} – ${Number(df)} ${MESES[Number(mf) - 1] ?? ""}`;
  return `${fmt(i)} – ${fmt(f)}`;
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
      "id, lugar, paradas, fecha_inicio, fecha_fin, ocasiones, maleta, weather, capsule_target, capsule_match, overrides, empacado, outfits, outfits_stale"
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

  // Sustitutos elegidos del clóset (guardados como "sub:<i>" dentro de overrides):
  // cubren una prenda que faltaba con una real del clóset.
  const subAt = (i: number) =>
    (overrides as Record<string, unknown> | null)?.[`sub:${i}`] as string | undefined;

  const rows: TripRow[] = capsuleRows(target, match, overrides).map((r) => {
    const by = subAt(r.index) ?? r.by;
    return {
      index: r.index,
      nombre: r.item.nombre,
      porque: r.item.porque,
      base: r.base,
      decision: r.decision,
      by,
      byImage: by ? imageMap[by] ?? null : null,
    };
  });

  const days = tripDays(trip.fecha_inicio, trip.fecha_fin);
  const weather = trip.weather as { temp_c: number; condition: string; estimated?: boolean } | null;
  const lug = luggageMeta(trip.maleta as Luggage | null);
  const paradas = Array.isArray(trip.paradas) ? (trip.paradas as { lugar?: string }[]) : [];
  const nParadas = paradas.length || 1;

  // Título: una parada → su nombre; varias → la primera "y N más".
  const destino =
    nParadas > 1
      ? `${(paradas[0]?.lugar ?? trip.lugar).split(",")[0].split(" · ")[0]} y ${nParadas - 1} más`
      : trip.lugar;

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

  // Conteos de las pestañas (estado inicial del server).
  const effInit = (r: TripRow) =>
    r.base === "parecido"
      ? r.decision === "accept"
        ? "tienes"
        : r.decision === "reject"
          ? "falta"
          : "parecido"
      : r.base;
  const maletaCount = rows.filter((r) => effInit(r) !== "falta" || empacado[String(r.index)]).length;
  const looksCount = resolvedOutfits?.length ?? 0;

  return (
    <AppShell>
      <section className="flex flex-col gap-4 pt-1">
        {/* Encabezado compartido (no cambia entre tabs). */}
        <div className="flex flex-col gap-1.5">
          <Link
            href="/viaje/lista"
            className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
          >
            <Icon name="chevron" size={15} rotate={180} />
            Modo viaje
          </Link>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink">
            Tu maleta para {destino}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Icon name="calendario" size={16} className="text-accent" />
            <span className="tabular">
              {rango(trip.fecha_inicio, trip.fecha_fin)} · {days} días
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
            {weather ? (
              <span className="flex items-center gap-1.5">
                <Icon name="termo" size={13} />~{weather.temp_c}°C
                {weather.estimated ? ", clima típico" : `, ${weather.condition}`}
              </span>
            ) : null}
            {nParadas > 1 ? (
              <>
                <span className="text-line">·</span>
                <span className="flex items-center gap-1.5">
                  <Icon name="ubicacion" size={13} />
                  <span className="tabular">{nParadas} paradas</span>
                </span>
              </>
            ) : null}
            {lug ? (
              <>
                <span className="text-line">·</span>
                <span className="flex items-center gap-1.5">
                  <Icon name="maleta" size={13} />
                  {lug.hint}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <TripTabs
          tripId={trip.id}
          maletaCount={maletaCount}
          looksCount={looksCount}
          looksStale={Boolean(trip.outfits_stale)}
          maleta={<TripResult tripId={trip.id} rows={rows} empacado={empacado} />}
          looks={
            <TripOutfits
              tripId={trip.id}
              outfits={resolvedOutfits}
              ocasiones={(trip.ocasiones as Occasion[]) ?? []}
              stale={Boolean(trip.outfits_stale)}
            />
          }
        />
      </section>
    </AppShell>
  );
}
