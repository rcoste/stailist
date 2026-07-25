import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";
import { loadJourneySignals } from "@/lib/journey-data";
import { Hint } from "@/components/hint";
import { HoyClient, type HoyOutfit } from "./hoy-client";
import type { ClosetPick } from "@/components/weather-picker";
import { loadClosetPicks } from "@/lib/closet-picks";
import { loadHomeCard } from "@/lib/home-card";
import { buildHomeChecklist } from "@/lib/home-checklist";
import { HomeChecklist } from "@/components/home-checklist";

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
    .is("deleted_at", null)
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

  // Clóset para el picker de ancla del wizard ("¿algo que te quieras poner hoy?"),
  // con las queridas primero (solo orden visual). Compartido con el modo viaje.
  const closet: ClosetPick[] = await loadClosetPicks(supabase, profile.id);

  // Card contextual del home idle. Solo se calcula cuando NO hay look listo:
  // con look en pantalla el home tiene otro trabajo y la card no se muestra.
  const homeCard = lookInicial ? null : await loadHomeCard(supabase, profile.id);

  const nombre = (profile.email ?? "").split("@")[0];

  // Checklist de activación: la superficie ÚNICA de "qué sigue" tras el primer
  // outfit (reemplazó los nudges de uno en uno). Las acciones de inversión que
  // predicen retención, con estado visible; se autodestruye al completarlas todas.
  const signals = await loadJourneySignals(supabase, profile);
  const checklist = buildHomeChecklist({
    hasAvatar: signals.hasAvatar,
    editedCloset: signals.editedCloset,
    hasStyleReference: profile.style_reference != null,
    hasCapsule: signals.hasCapsule,
    siluetaApplies: signals.siluetaApplies,
    hasSilueta: signals.hasSilueta,
  });
  // En la vista CON look, el checklist va en el banner (arriba del look) como la
  // card única que lo acompaña. En idle lo renderiza HoyClient en su pie.
  const checklistBanner = lookInicial ? checklist : null;

  // Hints contextuales (walkthrough just-in-time). UNA burbuja por pantalla:
  // el checklist (acción) gana sobre los hints (orientación) — cuando ocupa el
  // banner, los hints esperan.
  const seen = profile.hints_seen ?? {};
  const accountDays =
    (new Date().getTime() - new Date(profile.created_at).getTime()) / 86_400_000;
  // Progressive: orientación primero (hoy-casa), luego función de valor
  // (fab-generar → hoy-tryon) cuando ya hay look, y viaje al final. UNA por visita.
  const hint = checklistBanner
    ? null
    : !seen["hoy-casa"]
      ? "hoy-casa"
      : lookInicial && !seen["fab-generar"]
        ? "fab-generar"
        : lookInicial && !seen["hoy-tryon"]
          ? "hoy-tryon"
          : accountDays >= 3 && !seen["viaje"]
            ? "viaje"
            : null;

  // El stack de banners (checklist/hint) va centrado y angosto en desktop para no
  // estirarse a lo ancho de la columna wide del héroe (F3, plan desktop-full).
  const hasBanner = !!(hint || checklistBanner);

  return (
    <AppShell desktop="wide">
      <section className="flex flex-col gap-4 pt-4">
        {hasBanner ? (
          <div className="flex flex-col gap-4 lg:mx-auto lg:w-full lg:max-w-2xl">
            {checklistBanner ? <HomeChecklist checklist={checklistBanner} /> : null}
            {hint === "hoy-casa" ? (
              <Hint id="hoy-casa" center>
                esta es tu casa — cada día te espera un look nuevo aquí, pensado
                para tu plan y tu clima
              </Hint>
            ) : null}
            {hint === "fab-generar" ? (
              <Hint id="fab-generar">
                ¿otro plan hoy? tócalo y te armo un look nuevo desde cualquier
                pantalla
              </Hint>
            ) : null}
            {hint === "hoy-tryon" ? (
              <Hint id="hoy-tryon">
                ¿cómo te va a quedar? aquí te lo pruebo puesto en ti, no en una
                modelo
              </Hint>
            ) : null}
            {hint === "viaje" ? (
              <Hint id="viaje">
                ¿viaje pronto? aquí dentro te armo la maleta completa, con el
                clima de cada parada
              </Hint>
            ) : null}
          </div>
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
          homeCard={homeCard}
          checklist={checklist}
        />
      </section>
    </AppShell>
  );
}
