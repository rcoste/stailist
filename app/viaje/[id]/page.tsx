import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { capsuleRows, type CapsuleOverrides, type CapsuleMatch, type CapsuleTarget } from "@/lib/capsule";
import { loadClosetImageMap, loadClosetNameToId } from "@/lib/capsule-data";
import { faltaKey, catalogStorageKey } from "@/lib/capsule-images";
import { catalogPublicUrl } from "@/lib/catalog-render";
import { tripDays, luggageSummary, type Bolsas, type Luggage, type TripOutfit, type Occasion } from "@/lib/trip";
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
      "id, lugar, paradas, fecha_inicio, fecha_fin, ocasiones, maleta, bolsas, weather, capsule_target, capsule_match, overrides, empacado, outfits, outfits_stale"
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
  const [imageMap, nameToId] = await Promise.all([
    loadClosetImageMap(supabase, profile.id),
    loadClosetNameToId(supabase, profile.id),
  ]);

  // Biblioteca compartida: renders de catálogo ya generados (tipo+color+género),
  // para mostrar al instante la prenda sugerida sin tener que regenerarla. Misma
  // lógica que la cápsula del clóset.
  const gender = profile.gender;
  const skByItem = target.items.map((it) => ({
    fk: faltaKey(it),
    sk: catalogStorageKey(it.tipo, it.colorFamilia, gender),
  }));
  const { data: crows } = await supabase
    .from("catalog_renders")
    .select("key, path")
    .in(
      "key",
      skByItem.map((s) => s.sk)
    );
  const pathBySk = new Map((crows ?? []).map((r) => [r.key as string, r.path as string]));
  const catalogImages: Record<string, string> = {};
  for (const { fk, sk } of skByItem) {
    const path = pathBySk.get(sk);
    if (path) catalogImages[fk] = catalogPublicUrl(supabase, path);
  }

  // Prendas ya guardadas en la wishlist (para el estado del botón de cada faltante).
  const { data: wishRows } = await supabase
    .from("wishlist_items")
    .select("capsule_key")
    .eq("user_id", profile.id)
    .eq("source", "capsule");
  const savedWishKeys = (wishRows ?? [])
    .map((r) => r.capsule_key as string | null)
    .filter((k): k is string => !!k);

  // Sustitutos elegidos del clóset (guardados como "sub:<i>" dentro de overrides):
  // cubren una prenda que faltaba con una real del clóset.
  const subAt = (i: number) =>
    (overrides as Record<string, unknown> | null)?.[`sub:${i}`] as string | undefined;

  const rows: TripRow[] = capsuleRows(target, match, overrides).map((r) => {
    const by = subAt(r.index) ?? r.by;
    const fk = faltaKey(r.item);
    return {
      index: r.index,
      nombre: r.item.nombre,
      porque: r.item.porque,
      base: r.base,
      decision: r.decision,
      by,
      byImage: by ? imageMap[by] ?? null : null,
      faltaKey: fk,
      idealImage: catalogImages[fk] ?? null,
      renderArgs: {
        tipo: r.item.tipo,
        colorFamilia: r.item.colorFamilia,
        nombre: r.item.nombre,
        categoria: r.item.category,
        formalidad: r.item.formalidad,
        temporada: r.item.temporada,
        visual: r.item.visual,
      },
    };
  });

  const days = tripDays(trip.fecha_inicio, trip.fecha_fin);
  const weather = trip.weather as { temp_c: number; condition: string; estimated?: boolean } | null;
  const equipaje = luggageSummary(
    trip.bolsas as Bolsas | null,
    trip.maleta as Luggage | null
  );
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
        prendas: o.prendas.map((nombre) => ({
          nombre,
          image: imageMap[nombre] ?? null,
          id: nameToId[nombre] ?? null,
        })),
      }))
    : null;

  // Favoritos del viaje: los looks que promoviste a outfits reales (source=viaje)
  // viven en el Historial; aquí solo necesitamos los índices para pintar el corazón.
  const { data: favRows } = await supabase
    .from("outfits")
    .select("trip_look_index")
    .eq("user_id", profile.id)
    .eq("trip_id", trip.id)
    .eq("source", "viaje")
    .not("favorited_at", "is", null);
  const favoritos: number[] = (favRows ?? [])
    .map((r) => r.trip_look_index as number | null)
    .filter((i): i is number => i !== null);

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
            modo viaje
          </Link>
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.025em] text-ink">
            tu maleta para{" "}
            <em className="display font-normal italic">{destino}</em>
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
            {equipaje ? (
              <>
                <span className="text-line">·</span>
                <span className="flex items-center gap-1.5">
                  <Icon name="maleta" size={13} />
                  {equipaje}
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
          maleta={
            <TripResult
              tripId={trip.id}
              rows={rows}
              empacado={empacado}
              savedWishKeys={savedWishKeys}
            />
          }
          looks={
            <TripOutfits
              tripId={trip.id}
              outfits={resolvedOutfits}
              ocasiones={(trip.ocasiones as Occasion[]) ?? []}
              stale={Boolean(trip.outfits_stale)}
              favoritos={favoritos}
            />
          }
        />
      </section>
    </AppShell>
  );
}
