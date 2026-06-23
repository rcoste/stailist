import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadJourneySignals } from "@/lib/journey-data";
import { nextBestAction } from "@/lib/journey";
import { TryonNudge } from "@/components/tryon-nudge";
import { LinkNudge } from "@/components/link-nudge";
import { HoyClient, type HoyOutfit } from "./hoy-client";

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

  // ¿Ya hay look de hoy? Si sí, lo pasamos listo (no se regenera al abrir).
  const { data: look } = await supabase
    .from("outfits")
    .select("id, item_ids, title, explanation, tip, tryon_path, favorited_at")
    .eq("user_id", profile.id)
    .eq("is_look_of_day", true)
    .eq("look_date", today)
    .maybeSingle();

  let lookInicial: HoyOutfit | null = null;
  let votoInicial: "up" | "down" | null = null;
  let wornInicial = false;

  if (look) {
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
        const renderUrl =
          i.render_status === "done" && i.render_path
            ? signed.get(i.render_path as string)
            : null;
        const photoUrl = i.photo_path ? signed.get(i.photo_path as string) : null;
        return [
          i.id as string,
          {
            nombre: arch?.name ?? attrs.nombre ?? "Prenda",
            swatch: attrs.color_hex ?? "#E5E1DD",
            imagen: arch?.image_path ?? renderUrl ?? photoUrl ?? attrs.image_path ?? null,
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
          votoInicial={votoInicial}
          wornInicial={wornInicial}
          userId={profile.id}
          defaultObjective={profile.last_objective}
          autoAsk={autoAsk}
        />
      </section>
    </AppShell>
  );
}
