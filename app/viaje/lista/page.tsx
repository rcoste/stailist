import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tripDays } from "@/lib/trip";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmt(d: string): string {
  const [, m, day] = d.split("-");
  return `${Number(day)} ${MESES[Number(m) - 1] ?? ""}`;
}

// "Tus viajes": las maletas guardadas, con su propia pantalla (salió del wizard).
export default async function TusViajesPage() {
  const profile = await requireOnboarded();
  const supabase = await createClient();
  const { data: trips } = await supabase
    .from("trips")
    .select("id, lugar, fecha_inicio, fecha_fin, paradas")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <AppShell>
      <section className="flex flex-col gap-4 pt-1">
        <div className="flex flex-col gap-1.5 pt-3">
          <h1 className="text-h1 font-semibold text-ink">Modo viaje</h1>
          <p className="text-sm text-muted">
            Arma una maleta para tu próximo viaje, o abre una guardada.
          </p>
        </div>

        <Link
          href="/viaje"
          className="flex items-center gap-3 rounded-md border border-accent bg-accent-soft p-[13px] transition-colors hover:bg-accent-soft/70"
        >
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
            <Icon name="mas" size={18} strokeWidth={2} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold text-accent">Armar una maleta nueva</span>
            <span className="text-xs text-muted">dime a dónde y para cuándo</span>
          </span>
          <Icon name="chevron" size={16} className="ml-auto shrink-0 text-accent" />
        </Link>

        {trips && trips.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {trips.map((t) => {
              const paradas = Array.isArray(t.paradas) ? (t.paradas as unknown[]) : [];
              return (
                <Link
                  key={t.id}
                  href={`/viaje/${t.id}`}
                  className="flex items-center gap-3 rounded-md border border-line bg-surface p-[13px] transition-colors hover:border-accent"
                >
                  <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Icon name="maletin" size={16} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13.5px] font-semibold text-ink">{t.lugar}</span>
                    <span className="tabular text-[11.5px] text-muted">
                      {fmt(t.fecha_inicio)} – {fmt(t.fecha_fin)} ·{" "}
                      {tripDays(t.fecha_inicio, t.fecha_fin)} días
                      {paradas.length > 1 ? ` · ${paradas.length} paradas` : ""}
                    </span>
                  </span>
                  <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted">
            Aún no tienes viajes guardados.
          </p>
        )}
      </section>
    </AppShell>
  );
}
