import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";
import { loadJourneySignals } from "@/lib/journey-data";
import { nextBestAction } from "@/lib/journey";
import { TryonNudge } from "@/components/tryon-nudge";
import { LinkNudge } from "@/components/link-nudge";
import { HoyClient, type HoyOutfit } from "./hoy-client";
import type { ClosetPick } from "@/components/weather-picker";

export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ generar?: string }>;
}) {
  const { generar } = await searchParams;
  // El botón ✨ manda ?generar=<timestamp> (cualquier valor presente cuenta).
  const autoAsk = generar != null;
  const profile = await requireOnboarded();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // ¿Ya hay look de hoy? Si está listo, lo pasamos. Si se está generando en
  // background, pasamos su id para que el cliente retome el polling (resiliente a
  // que bloquees/cambies de app a media carga).
  const { data: look } = await supabase
    .from("outfits")
    .select("id, item_ids, title, explanation, tip, tryon_path, favorited_at, gen_status, created_at")
    .eq("user_id", profile.id)
    .eq("is_look_of_day", true)
    .eq("look_date", today)
    .maybeSingle();

  const lookStatus = look ? ((look.gen_status as string | null) ?? "ready") : null;
  const stale =
    !!look && new Date().getTime() - new Date(look.created_at as string).getTime() > 150_000;
  // El look del día sigue generándose (y no murió) → retomar polling en el cliente.
  const pendingOutfitId =
    look && lookStatus === "generating" && !stale ? (look.id as string) : null;

  let lookInicial: HoyOutfit | null = null;
  let votoInicial: "up" | "down" | null = null;
  let wornInicial = false;

  if (look && lookStatus === "ready") {
    const [{ data: items }, { data: events }] = await Promise.all([
      // Misma resolución de imagen que el clóset: arquetipo, render o foto propia.
      // Antes solo leía attrs.image_path → las prendas fotografiadas (o arquetipos
      // sin ese backfill) salían sin imagen, como un recuadro de color.
      supabase
        .from("items")
        .select(
          "id, photo_path, render_status, render_path, attrs, archetypes(name, image_path)"
        )
        .in("id", look.item_ids as string[]),
      supabase
        .from("events")
        .select("type")
        .eq("user_id", profile.id)
        .eq("outfit_id", look.id)
        .in("type", ["vote_up", "vote_down", "worn"]),
    ]);

    // Fotos propias y renders viven en el bucket privado → URL firmada. Juntamos
    // el try-on del look y los paths de las prendas en una sola petición de firmas.
    const itemPaths = (items ?? [])
      .flatMap((i) => [i.photo_path as string | null, i.render_path as string | null])
      .filter((p): p is string => !!p);
    const toSign = Array.from(
      new Set([...(look.tryon_path ? [look.tryon_path as string] : []), ...itemPaths])
    );
    const signed = new Map<string, string>();
    if (toSign.length > 0) {
      const { data } = await supabase.storage.from("prendas").createSignedUrls(toSign, 3600);
      data?.forEach((s) => {
        if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
      });
    }

    const byId = new Map(
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

    const tryon: string | null = look.tryon_path
      ? signed.get(look.tryon_path as string) ?? null
      : null;

    lookInicial = {
      id: look.id,
      nombre: look.title ?? "Tu look",
      explicacion: look.explanation,
      tip: look.tip ?? null,
      tryon,
      favorited: !!look.favorited_at,
      prendas: (look.item_ids as string[]).map((id) => {
        const p = byId.get(id);
        return {
          id,
          nombre: p?.nombre ?? "Prenda",
          swatch: p?.swatch ?? "#E5E1DD",
          imagen: p?.imagen ?? null,
        };
      }),
    };
    for (const ev of events ?? []) {
      if (ev.type === "vote_up") votoInicial = "up";
      else if (ev.type === "vote_down") votoInicial = "down";
      else if (ev.type === "worn") wornInicial = true;
    }
  }

  // Clóset para el picker de ancla del wizard ("¿algo que te quieras poner hoy?").
  // Misma resolución de imagen que el clóset (arquetipo / render / foto propia).
  const { data: closetRows } = await supabase
    .from("items")
    .select("id, photo_path, render_status, render_path, attrs, archetypes(name, image_path, category)")
    .eq("user_id", profile.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const closetPaths = (closetRows ?? [])
    .flatMap((i) => [i.photo_path as string | null, i.render_path as string | null])
    .filter((p): p is string => !!p);
  const closetSigned = new Map<string, string>();
  if (closetPaths.length > 0) {
    const { data } = await supabase.storage
      .from("prendas")
      .createSignedUrls(Array.from(new Set(closetPaths)), 3600);
    data?.forEach((s) => {
      if (s.path && s.signedUrl) closetSigned.set(s.path, s.signedUrl);
    });
  }
  const closet: ClosetPick[] = (closetRows ?? []).map((i) => {
    const arch = i.archetypes as {
      name?: string;
      image_path?: string | null;
      category?: string | null;
    } | null;
    const attrs = (i.attrs ?? {}) as {
      nombre?: string;
      color_hex?: string;
      image_path?: string | null;
      category?: string | null;
    };
    return {
      id: i.id as string,
      nombre: arch?.name ?? attrs.nombre ?? "Prenda",
      swatch: attrs.color_hex ?? "#E5E1DD",
      imagen: itemImageUrlSync(i as ItemImageRow, (p) => closetSigned.get(p)),
      category: arch?.category ?? attrs.category ?? "otros",
    };
  });

  const nombre = (profile.email ?? "").split("@")[0];

  // Motor de nudges: solo cuando ya hay look listo (contexto para el try-on).
  const signals = await loadJourneySignals(supabase, profile);
  const nudge = lookInicial
    ? nextBestAction(profile.journey_state, signals)
    : null;

  return (
    <AppShell>
      <section className="flex flex-col gap-4 pt-4">
        {nudge === "tryon" ? <TryonNudge /> : null}
        {nudge === "closet_real" ? (
          <LinkNudge
            id="closet_real"
            icon="gancho"
            title="Haz tuyo tu clóset"
            body="Súmale tu ropa real y tus looks se vuelven 100% tuyos."
            href="/closet"
          />
        ) : null}
        {nudge === "capsula" ? (
          <LinkNudge
            id="capsula"
            icon="destello"
            title="Arma tu clóset cápsula"
            body="Te digo qué prendas ya tienes y cuáles te faltan."
            href="/closet/capsula/editar"
          />
        ) : null}
        {nudge === "silueta" ? (
          <LinkNudge
            id="silueta"
            icon="persona"
            title="Cuéntame de tu cuerpo"
            body="Marca tu silueta y afino tus looks a tu medida."
            href="/perfil/silueta"
          />
        ) : null}
        <HoyClient
          key={`${nombre}:${generar ?? "view"}`}
          lookInicial={lookInicial}
          pendingOutfitId={pendingOutfitId}
          votoInicial={votoInicial}
          wornInicial={wornInicial}
          userId={profile.id}
          defaultObjective={profile.last_objective}
          closet={closet}
          autoAsk={autoAsk}
        />
      </section>
    </AppShell>
  );
}
