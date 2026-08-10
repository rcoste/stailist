import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";
import { HistoryList, type HistoryOutfit } from "./history-list";

/** Color de relleno cuando una prenda no tiene ni imagen ni color leído.
 *
 *  Era un `#E5E1DD` suelto repetido en dos pantallas — un hex a un punto de
 *  `--c-line` (#e4e3e0) que nadie iba a mantener sincronizado. Va al token: es
 *  un hueco de la UI, no el color de una prenda. */
const SWATCH_VACIO = "var(--c-line)";

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  // El atajo "favoritos" del drawer entra con ?filtro=fav para abrir ya filtrado.
  const { filtro } = await searchParams;
  const initialFiltro = filtro === "fav" ? "fav" : "todos";
  const profile = await requireOnboarded();
  const supabase = await createClient();

  const { data: outfits } = await supabase
    .from("outfits")
    .select("id, title, explanation, tip, occasion, item_ids, created_at, favorited_at, tryon_path, photo_path, resumen, source")
    .eq("user_id", profile.id)
    .is("deleted_at", null)
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
      // La foto que ella subió en "¿me veo bien?". Va al mismo lote de firmas:
      // sin esto, la entrada del espejo cae en el diario SIN imagen y sin
      // prendas —item_ids va vacío a propósito— o sea, una tarjeta en blanco.
      // Prometerle "ya quedó en tu diario" y que ahí no se vea nada es peor que
      // no guardarlo.
      ...(outfits ?? []).map((o) => o.photo_path as string | null),
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
          swatch: attrs.color_hex ?? SWATCH_VACIO,
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
    tip: (o.tip as string | null) ?? null,
    createdAt: o.created_at as string,
    fecha: new Date(o.created_at).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
    }),
    occasion: (o.occasion as string | null) ?? null,
    origen:
      (o.source as string | null) === "viaje"
        ? "viaje"
        : (o.source as string | null) === "capsula"
          ? "capsula"
          : (o.source as string | null) === "espejo"
            ? "espejo"
            : "daily",
    // El espejo REUSA el hueco de la imagen grande: es exactamente lo mismo
    // —una foto de ella con el look puesto— sólo que real en vez de renderizada.
    resumen: (o.resumen as string | null) ?? null,
    tryonImage: o.tryon_path
      ? signed.get(o.tryon_path as string) ?? null
      : o.photo_path
        ? signed.get(o.photo_path as string) ?? null
        : null,
    prendas: (o.item_ids as string[]).map(
      (id) => imgById.get(id) ?? { nombre: "Prenda", swatch: SWATCH_VACIO, imagen: null }
    ),
    voto: votoByOutfit.get(o.id) ?? null,
    worn: wornOutfits.has(o.id),
    favorited: !!o.favorited_at,
  }));

  return (
    <AppShell desktop="wide">
      <section className="flex flex-col gap-5 pt-4">
        <div>
          <h1 className="text-[30px] font-bold leading-none tracking-[-0.02em] text-ink">
            historial
          </h1>
          <p className="mt-1.5 text-sm text-muted">tus looks pasados viven aquí.</p>
        </div>

        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-surface px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-line text-muted">
              <Icon name="reloj" size={26} />
            </span>
            <p className="editorial text-lg text-ink">tu primer look te espera</p>
            <p className="text-sm text-muted">
              cuando generes outfits, aquí podrás volver a verlos, votarlos y
              volvértelos a poner.
            </p>
            <Link
              href="/hoy"
              className="flex min-h-12 items-center rounded-sm bg-accent px-6 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
            >
              genera tu look de hoy
            </Link>
          </div>
        ) : (
          // Aquí vivía el tip "márcale me lo puse". Se quitó el 2026-07-29: esa
          // acción ya no está en esta pantalla —el worn del mismo día se movió a
          // Hoy, como la card "¿te lo pusiste?" del día siguiente— así que
          // mandaba a buscar un botón que no existe. Y la card pregunta sola,
          // con sí/no de un tap: no hay nada que explicar.
          <HistoryList outfits={list} initialFiltro={initialFiltro} />
        )}
      </section>
    </AppShell>
  );
}
