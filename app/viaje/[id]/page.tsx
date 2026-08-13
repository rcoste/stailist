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
import {
  tripDays,
  tripLogicLine,
  luggageSummary,
  rangoFechas,
  nombreDeViaje,
  tripConfirmado,
  type Bolsas,
  type Luggage,
  type Parada,
  type TripOutfit,
  type Occasion,
} from "@/lib/trip";
import { fotosDeViajes } from "@/lib/destino-imagen-cache";
import { candidatasDeOverrides } from "@/lib/trip-candidatas";
import { TripResult, type TripRow } from "@/components/trip-result";
import { TripOutfits, type ResolvedOutfit } from "@/components/trip-outfits";
import { TripTabs } from "@/components/trip-tabs";
import { TripPackedProvider, TripPackedBar } from "@/components/trip-packed-context";
import { DeleteTripButton } from "@/components/delete-trip-button";

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
    .is("deleted_at", null)
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
  // Todo lo que solo depende del perfil o del viaje ya cargado va en UN
  // Promise.all — en serie eran ~2 round-trips extra por render (review).
  const [imageMap, nameToId, { data: wishRows }, fotosMapa] = await Promise.all([
    loadClosetImageMap(supabase, profile.id),
    loadClosetNameToId(supabase, profile.id),
    supabase
      .from("wishlist_items")
      .select("capsule_key")
      .eq("user_id", profile.id)
      .eq("source", "capsule"),
    fotosDeViajes(supabase, [
      { lugar: trip.lugar as string, ocasiones: (trip.ocasiones as string[] | null) ?? [] },
    ]),
  ]);
  const savedWishKeys = (wishRows ?? [])
    .map((r) => r.capsule_key as string | null)
    .filter((k): k is string => !!k);
  const fotoDestino = fotosMapa.get(trip.lugar as string) ?? "/destinos/ciudad.webp";

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
  // La firma del motor (viajes nuevos) gana; la plantilla determinística es el
  // fallback para maletas generadas antes de que el motor explicara su lógica.
  const logica =
    target.firma?.trim() ||
    tripLogicLine(days, rows.length, (trip.ocasiones as Occasion[]) ?? [], weather);
  const equipaje = luggageSummary(
    trip.bolsas as Bolsas | null,
    trip.maleta as Luggage | null
  );
  const paradas = Array.isArray(trip.paradas) ? (trip.paradas as Parada[]) : [];
  const nParadas = paradas.length || 1;

  // Título: una parada → su nombre; varias → el país compartido ("Japón") o
  // "Tokio y 2 más" si la ruta cruza países.
  const destino = nombreDeViaje(trip.lugar as string, paradas);

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

  // Filas de outfits de este viaje: el corazón (favorited_at) y el try-on ya
  // generado (tryon_path). Ahora hay filas SIN favorito — las crea "verme con
  // este look" solo para poder generar y cachear el render, y no entran al
  // Historial (que filtra por favorited_at).
  const { data: lookRows } = await supabase
    .from("outfits")
    .select("trip_look_index, favorited_at, tryon_path")
    .eq("user_id", profile.id)
    .is("deleted_at", null)
    .eq("trip_id", trip.id)
    .eq("source", "viaje");
  const favoritos: number[] = (lookRows ?? [])
    .filter((r) => !!r.favorited_at)
    .map((r) => r.trip_look_index as number | null)
    .filter((i): i is number => i !== null);
  const tryonPaths = (lookRows ?? [])
    .map((r) => r.tryon_path as string | null)
    .filter((p): p is string => !!p);
  const signedTryon = new Map<string, string>();
  if (tryonPaths.length > 0) {
    const { data } = await supabase.storage.from("prendas").createSignedUrls(tryonPaths, 3600);
    data?.forEach((s) => {
      if (s.path && s.signedUrl) signedTryon.set(s.path, s.signedUrl);
    });
  }
  const tryonByIndex = new Map<number, string>(
    (lookRows ?? []).flatMap((r) => {
      const i = r.trip_look_index as number | null;
      const url = r.tryon_path ? signedTryon.get(r.tryon_path as string) : null;
      return i !== null && url ? [[i, url] as [number, string]] : [];
    })
  );
  if (resolvedOutfits) {
    for (let i = 0; i < resolvedOutfits.length; i++) {
      const url = tryonByIndex.get(i);
      if (url) resolvedOutfits[i] = { ...resolvedOutfits[i], tryonImage: url };
    }
  }

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
  // Revisión cerrada ("✓ listo — a empacar"): la llave y su grandfathering
  // tienen dueño único en lib/trip (tripConfirmado).
  const confirmado = tripConfirmado(overrides as Record<string, unknown> | null, rawOutfits);
  // Las candidatas del duelo ya calculadas (overrides "cand:i"), con su imagen
  // resuelta contra el mismo mapa del clóset que usa todo lo demás.
  const { candidatas, descartados, ganados } = candidatasDeOverrides(
    overrides as Record<string, unknown> | null,
    (nombre) => imageMap[nombre] ?? null
  );
  // Índices de lo empacable (para la barra del rail de desktop — el estado vivo
  // de los checks lo pone el TripPackedProvider).
  const empacaIndices = rows
    .filter((r) => effInit(r) !== "falta" || empacado[String(r.index)])
    .map((r) => r.index);

  // Las dos líneas del header (portada y compacto): la parte bold (fechas ·
  // días) y el resto (clima · paradas · equipaje).
  const fechas = `${rangoFechas(trip.fecha_inicio, trip.fecha_fin)} · ${days} días`;
  const metaExtra =
    [
      weather ? `~${weather.temp_c}°C` : null,
      nParadas > 1 ? `${nParadas} paradas` : null,
      equipaje,
    ]
      .filter(Boolean)
      .join(" · ") || null;

  return (
    <AppShell desktop="wide">
      <TripPackedProvider initial={empacado}>
      {/* Desktop (F3): 2 columnas — rail del viaje sticky a la izquierda
          (resumen/clima/progreso), pestañas a la derecha. Móvil (handoff
          viaje 2): el header vive DENTRO de TripTabs — portada en "el plan",
          compacto en las pestañas de trabajo. */}
      <section className="flex flex-col gap-4 pt-1 lg:flex-row lg:items-start lg:gap-10">
        {/* Rail de desktop (móvil tiene su header en TripTabs). */}
        <div className="hidden flex-col gap-1.5 lg:sticky lg:top-20 lg:flex lg:w-[34%] lg:shrink-0">
          <Link
            href="/viaje/lista"
            className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
          >
            <Icon name="chevron" size={15} rotate={180} />
            modo viaje
          </Link>
          {/* La foto del destino como portada del viaje (B&N editorial: el
              color es de tu ropa). */}
          <div className="relative mt-1 overflow-hidden rounded-md border border-line bg-tile">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoDestino} alt="" className="h-[150px] w-full object-cover" />
          </div>
          <h1 className="mt-1 text-[32px] font-bold leading-tight tracking-[-0.025em] text-ink">
            tu maleta para{" "}
            <em className="display font-normal italic">{destino}</em>
          </h1>
          <div className="mt-1 flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Icon name="calendario" size={16} className="text-accent" />
            <span className="tabular">{fechas}</span>
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

          {/* Progreso de empacado en el rail (solo desktop; en móvil vive en el
              tab). Solo con la revisión cerrada: durante el plan aún no se
              empaca y una barra en ceros presionaría a palomear antes de decidir. */}
          {confirmado ? (
            <div className="lg:mt-6">
              <TripPackedBar empacaIndices={empacaIndices} />
            </div>
          ) : null}

          <Link
            href={`/viaje?edit=${trip.id}`}
            className="mt-5 flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-ink"
          >
            <Icon name="lapiz" size={14} />
            editar ruta y fechas
          </Link>
          <DeleteTripButton tripId={trip.id as string} lugar={destino} />
        </div>

        <div className="lg:min-w-0 lg:flex-1">
        <TripTabs
          tripId={trip.id}
          destino={destino}
          fechas={fechas}
          metaExtra={metaExtra}
          foto={fotoDestino}
          firma={logica || null}
          actividades={(trip.ocasiones as Occasion[]) ?? []}
          prendasCount={rows.length}
          looksCount={looksCount}
          looksStale={Boolean(trip.outfits_stale)}
          confirmado={confirmado}
          maleta={
            <TripResult
              tripId={trip.id}
              rows={rows}
              savedWishKeys={savedWishKeys}
              candidatasIniciales={candidatas}
              descartadosIniciales={descartados}
              ganadosIniciales={ganados}
            />
          }
          looks={
            <TripOutfits
              tripId={trip.id}
              outfits={resolvedOutfits}
              ocasiones={(trip.ocasiones as Occasion[]) ?? []}
              stale={Boolean(trip.outfits_stale)}
              favoritos={favoritos}
              maletaCount={confirmado ? maletaCount : rows.length}
            />
          }
        />
        </div>
      </section>
      </TripPackedProvider>
    </AppShell>
  );
}
