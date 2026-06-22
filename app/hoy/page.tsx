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
    .select("id, item_ids, title, explanation, tryon_path, favorited_at")
    .eq("user_id", profile.id)
    .eq("is_look_of_day", true)
    .eq("look_date", today)
    .maybeSingle();

  let lookInicial: HoyOutfit | null = null;
  let votoInicial: "up" | "down" | null = null;
  let wornInicial = false;

  if (look) {
    const [{ data: items }, { data: events }] = await Promise.all([
      supabase
        .from("items")
        .select("id, attrs")
        .in("id", look.item_ids as string[]),
      supabase
        .from("events")
        .select("type")
        .eq("user_id", profile.id)
        .eq("outfit_id", look.id)
        .in("type", ["vote_up", "vote_down", "worn"]),
    ]);

    const byId = new Map(
      (items ?? []).map((i) => [
        i.id,
        i.attrs as {
          nombre?: string;
          color_hex?: string;
          image_path?: string | null;
        },
      ])
    );

    let tryon: string | null = null;
    if (look.tryon_path) {
      const { data: signed } = await supabase.storage
        .from("prendas")
        .createSignedUrl(look.tryon_path as string, 3600);
      tryon = signed?.signedUrl ?? null;
    }

    lookInicial = {
      id: look.id,
      nombre: look.title ?? "Tu look",
      explicacion: look.explanation,
      tryon,
      favorited: !!look.favorited_at,
      prendas: (look.item_ids as string[]).map((id) => ({
        nombre: byId.get(id)?.nombre ?? "Prenda",
        swatch: byId.get(id)?.color_hex ?? "#E5E1DD",
        imagen: byId.get(id)?.image_path ?? null,
      })),
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
