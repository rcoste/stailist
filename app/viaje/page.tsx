import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TripForm } from "@/components/trip-form";
import { tripDays } from "@/lib/trip";

export const maxDuration = 60;

function fmt(d: string): string {
  const [, m, day] = d.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${Number(day)} ${meses[Number(m) - 1] ?? ""}`;
}

export default async function ViajePage() {
  const profile = await requireOnboarded();
  const supabase = await createClient();
  const { data: trips } = await supabase
    .from("trips")
    .select("id, lugar, fecha_inicio, fecha_fin")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <AppShell>
      <section className="flex flex-col gap-5 pt-4">
        <Link href="/hoy" className="text-sm font-medium text-muted hover:text-ink">
          ← Hoy
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 font-semibold text-ink">Modo viaje</h1>
          <p className="text-sm text-muted">
            Dime a dónde vas y armo tu maleta — lo mínimo que combina, y qué te falta.
          </p>
        </div>

        <TripForm />

        {trips && trips.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Tus viajes
            </span>
            <div className="flex flex-col gap-2">
              {trips.map((t) => (
                <Link
                  key={t.id}
                  href={`/viaje/${t.id}`}
                  className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 transition-colors hover:border-accent"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Icon name="maletin" size={16} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-ink">{t.lugar}</span>
                    <span className="text-xs text-muted">
                      {fmt(t.fecha_inicio)} – {fmt(t.fecha_fin)} ·{" "}
                      {tripDays(t.fecha_inicio, t.fecha_fin)} días
                    </span>
                  </span>
                  <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
