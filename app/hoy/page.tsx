import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HoyClient, type HoyOutfit } from "./hoy-client";

export default async function HoyPage() {
  const profile = await requireOnboarded();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // ¿Ya hay look de hoy? Si sí, lo pasamos listo (no se regenera al abrir).
  const { data: look } = await supabase
    .from("outfits")
    .select("id, item_ids, title, explanation")
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
    lookInicial = {
      id: look.id,
      nombre: look.title ?? "Tu look",
      explicacion: look.explanation,
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

  return (
    <AppShell>
      <section className="flex flex-col gap-4 pt-4">
        <div>
          <h1 className="text-h1 font-semibold text-ink">Hoy</h1>
          <p className="text-sm text-muted">
            {lookInicial
              ? "Tu look, listo para tu día."
              : "Te estamos armando un look para hoy."}
          </p>
        </div>

        <HoyClient
          key={nombre}
          lookInicial={lookInicial}
          votoInicial={votoInicial}
          wornInicial={wornInicial}
        />
      </section>
    </AppShell>
  );
}
