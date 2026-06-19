import { createClient } from "@/lib/supabase/server";
import { LOOKS } from "@/lib/looks";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="text-h1 font-semibold text-ink">{value}</span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

export default async function AdminOverview() {
  const supabase = await createClient();

  const [usersC, archsC, outfitsC, eventsRes] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("archetypes").select("*", { count: "exact", head: true }),
    supabase.from("outfits").select("*", { count: "exact", head: true }),
    supabase
      .from("events")
      .select("type, data")
      .in("type", ["vote_up", "vote_down", "worn", "first_outfit_ttv", "trip_look_vote"]),
  ]);

  const events = eventsRes.data ?? [];
  const ups = events.filter((e) => e.type === "vote_up").length;
  const downs = events.filter((e) => e.type === "vote_down").length;
  const worn = events.filter((e) => e.type === "worn").length;
  const ttvs = events
    .filter((e) => e.type === "first_outfit_ttv")
    .map((e) => (e.data as { seconds?: number })?.seconds)
    .filter((s): s is number => typeof s === "number");

  // Votos sobre looks de viaje (señal aparte del ratio del motor diario).
  const tripVotes = events.filter((e) => e.type === "trip_look_vote");
  const tripUps = tripVotes.filter((e) => (e.data as { vote?: string })?.vote === "up").length;
  const tripRatio =
    tripVotes.length > 0 ? Math.round((tripUps / tripVotes.length) * 100) : null;

  const votos = ups + downs;
  const ratio = votos > 0 ? Math.round((ups / votos) * 100) : null;
  const ttvAvg =
    ttvs.length > 0 ? Math.round(ttvs.reduce((a, b) => a + b, 0) / ttvs.length) : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h2 font-semibold text-ink">Overview</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Usuarias" value={String(usersC.count ?? 0)} />
        <Stat label="Básicos" value={String(archsC.count ?? 0)} hint="catálogo" />
        <Stat label="Looks (swipes)" value={String(LOOKS.length)} />
        <Stat label="Outfits generados" value={String(outfitsC.count ?? 0)} />
        <Stat
          label="Ratio 👍"
          value={ratio === null ? "—" : `${ratio}%`}
          hint={votos > 0 ? `${ups}/${votos} votos` : "sin votos aún"}
        />
        <Stat
          label="TTV promedio"
          value={ttvAvg === null ? "—" : `${ttvAvg}s`}
          hint={
            ttvAvg === null
              ? "sin datos"
              : ttvAvg <= 120
                ? "✓ bajo 2 min"
                : "⚠ sobre 2 min"
          }
        />
        <Stat
          label="Looks de viaje 👍"
          value={tripRatio === null ? "—" : `${tripRatio}%`}
          hint={tripVotes.length > 0 ? `${tripUps}/${tripVotes.length} votos` : "sin votos aún"}
        />
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Señal de oro
        </span>
        <span className="text-base text-ink">
          {worn === 0
            ? "Nadie se ha puesto un look todavía."
            : `${worn} ${worn === 1 ? "vez que alguien marcó" : "veces que marcaron"} "me lo puse".`}
        </span>
      </div>
    </div>
  );
}
