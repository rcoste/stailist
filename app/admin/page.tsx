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

// Segundos legibles: bajo 2 min se ven como "90s"; arriba, en minutos.
function fmtDur(s: number): string {
  return s < 120 ? `${s}s` : `${Math.round(s / 60)}min`;
}

// Encabezado de bloque del dashboard. Mantiene el mismo registro visual que el
// resto del admin (label apagado en mayúsculas).
function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        {children}
      </h2>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

// Los 6 pasos del onboarding, en orden. El paso es el valor de
// profiles.onboarding_step al COMPLETARLO (0 = cuenta recién creada).
const FUNNEL_STEPS = [
  { step: 0, label: "Creó cuenta" },
  { step: 1, label: "Swipes de gustos" },
  { step: 2, label: "Colorimetría" },
  { step: 3, label: "Eligió básicos" },
  { step: 4, label: "Definió objetivo" },
  { step: 5, label: "Generó su primer look" },
];

type CriticVerdict = "ok" | "reparado" | "rechazado";
type CriticChange = { verdict?: CriticVerdict };
type CriticData = { changes?: CriticChange[] };

export default async function AdminOverview() {
  const supabase = await createClient();

  // Ventana de "activos": eventos en los últimos 7 días.
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    profilesRes,
    archsC,
    outfitsC,
    eventsRes,
    criticRes,
    skipRes,
    active7dRes,
    tripsC,
    estiloViewRes,
  ] = await Promise.all([
    // Perfiles completos para embudo + adopción (avatar, cápsula). En beta la
    // tabla es chica; traemos solo las columnas que el dashboard necesita.
    supabase
      .from("profiles")
      .select("onboarding_step, avatar_path, capsule_target"),
    supabase.from("archetypes").select("*", { count: "exact", head: true }),
    supabase
      .from("outfits")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("events")
      .select("type, data")
      .in("type", ["vote_up", "vote_down", "worn", "first_outfit_ttv", "trip_look_vote"]),
    // Estabilidad del motor: veredicto del juez de 2ª pasada por outfit.
    supabase.from("events").select("data").eq("type", "critic_review"),
    // La carnita: por qué pidieron "otro look" (👎 con razón escrita).
    supabase
      .from("events")
      .select("data, created_at")
      .eq("type", "another_look")
      .order("created_at", { ascending: false })
      .limit(40),
    // Activos 7d: usuarias distintas con cualquier evento en la ventana.
    supabase.from("events").select("user_id").gte("created_at", since7d),
    supabase.from("trips").select("*", { count: "exact", head: true }),
    // ¿Alguien ABRE perfil → estilo? Sus dos campos (referencia y palabras)
    // llevan semanas vacíos y sin esto no se puede distinguir "la petición no
    // convence" de "nadie llega". user_id para contar PERSONAS, no visitas.
    supabase.from("events").select("user_id").eq("type", "perfil_estilo_view"),
  ]);

  const estiloVisitas = estiloViewRes.data?.length ?? 0;
  const estiloPersonas = new Set(
    (estiloViewRes.data ?? []).map((e) => e.user_id as string)
  ).size;

  // ── KPIs de votos / TTV (igual que antes) ──────────────────────────────
  const events = eventsRes.data ?? [];
  const ups = events.filter((e) => e.type === "vote_up").length;
  const downs = events.filter((e) => e.type === "vote_down").length;
  const worn = events.filter((e) => e.type === "worn").length;
  const ttvs = events
    .filter((e) => e.type === "first_outfit_ttv")
    .map((e) => (e.data as { seconds?: number })?.seconds)
    .filter((s): s is number => typeof s === "number");

  const tripVotes = events.filter((e) => e.type === "trip_look_vote");
  const tripUps = tripVotes.filter((e) => (e.data as { vote?: string })?.vote === "up").length;
  const tripRatio =
    tripVotes.length > 0 ? Math.round((tripUps / tripVotes.length) * 100) : null;

  const votos = ups + downs;
  const ratio = votos > 0 ? Math.round((ups / votos) * 100) : null;
  // Mediana, no promedio: el TTV se mide desde created_at, así que una usuaria
  // que volvió al día siguiente a generar su primer look mete un outlier de
  // horas que dispara la media. La mediana aguanta esos casos.
  const ttvMedian = (() => {
    if (ttvs.length === 0) return null;
    const sorted = [...ttvs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];
  })();

  // ── Perfiles, embudo y adopción ────────────────────────────────────────
  const profiles = profilesRes.data ?? [];
  const totalUsers = profiles.length;
  const reached = (step: number) =>
    profiles.filter((p) => (p.onboarding_step ?? 0) >= step).length;
  const completos = reached(5);
  const completionPct = totalUsers > 0 ? Math.round((completos / totalUsers) * 100) : null;

  const conAvatar = profiles.filter((p) => p.avatar_path).length;
  const conCapsula = profiles.filter((p) => p.capsule_target).length;

  // Activos 7d: usuarias únicas.
  const active7d = new Set(
    (active7dRes.data ?? []).map((e) => e.user_id).filter(Boolean)
  ).size;

  // ── Estabilidad del motor (juez) ───────────────────────────────────────
  const criticFailed = !!criticRes.error;
  const verdictCounts = { ok: 0, reparado: 0, rechazado: 0 };
  for (const row of criticRes.data ?? []) {
    const changes = (row.data as CriticData)?.changes ?? [];
    for (const c of changes) {
      if (c.verdict && c.verdict in verdictCounts) verdictCounts[c.verdict]++;
    }
  }
  const totalJudged =
    verdictCounts.ok + verdictCounts.reparado + verdictCounts.rechazado;
  const pctOk = totalJudged > 0 ? Math.round((verdictCounts.ok / totalJudged) * 100) : null;

  // ── Razones de "otro look" ─────────────────────────────────────────────
  const skipReasons = (skipRes.data ?? [])
    .map((e) => (e.data as { reason?: string })?.reason?.trim())
    .filter((r): r is string => !!r);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-h2 font-semibold text-ink">Dashboard del experimento</h1>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Usuarias" value={String(totalUsers)} />
        <Stat
          label="Onboarding completo"
          value={completionPct === null ? "—" : `${completionPct}%`}
          hint={totalUsers > 0 ? `${completos}/${totalUsers} llegaron al final` : "sin usuarias aún"}
        />
        <Stat label="Activas (7 días)" value={String(active7d)} hint="con actividad reciente" />
        <Stat label="Outfits generados" value={String(outfitsC.count ?? 0)} />
        <Stat
          label="Abren perfil → estilo"
          value={String(estiloPersonas)}
          hint={
            estiloVisitas > 0
              ? `${estiloVisitas} visitas · de ${totalUsers} perfiles`
              : "nadie ha entrado aún"
          }
        />
        <Stat
          label="Ratio 👍"
          value={ratio === null ? "—" : `${ratio}%`}
          hint={votos > 0 ? `${ups}/${votos} votos` : "sin votos aún"}
        />
        <Stat
          label="TTV típico"
          value={ttvMedian === null ? "—" : fmtDur(ttvMedian)}
          hint={
            ttvMedian === null
              ? "sin datos"
              : `mediana de ${ttvs.length} · ${ttvMedian <= 120 ? "✓ bajo 2 min" : "⚠ sobre 2 min"}`
          }
        />
      </div>

      {/* Señal de oro */}
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

      {/* ── Embudo de onboarding ─────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <SectionTitle hint="cuántas usuarias llegaron a cada paso — dónde se caen">
          Embudo de onboarding
        </SectionTitle>
        {totalUsers === 0 ? (
          <p className="text-sm text-muted">Sin usuarias todavía.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {FUNNEL_STEPS.map(({ step, label }) => {
              const count = reached(step);
              const prev = step === 0 ? count : reached(step - 1);
              const drop = prev - count;
              const pct = totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0;
              return (
                <div key={step} className="flex flex-col gap-1.5 px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink">{label}</span>
                    <span className="shrink-0 text-muted">
                      {count}
                      {drop > 0 ? (
                        <span className="text-error"> · −{drop}</span>
                      ) : null}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Estabilidad del motor ────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <SectionTitle hint="veredicto del juez de 2ª pasada, por outfit generado">
          Estabilidad del motor
        </SectionTitle>
        {criticFailed ? (
          <p className="text-sm text-error">No se pudo cargar (error de consulta).</p>
        ) : totalJudged === 0 ? (
          <p className="text-sm text-muted">El juez aún no ha revisado outfits.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              <Stat
                label="✓ Aprobados"
                value={`${pctOk}%`}
                hint={`${verdictCounts.ok} de ${totalJudged}`}
              />
              <Stat
                label="Reparados"
                value={String(verdictCounts.reparado)}
                hint="el juez los ajustó"
              />
              <Stat
                label="Rechazados"
                value={String(verdictCounts.rechazado)}
                hint="irreparables con ese clóset"
              />
            </div>
            <p className="text-xs text-muted">
              Meta: ≥70% aprobados sin tocar.{" "}
              {pctOk !== null && pctOk >= 70 ? "✓ vas bien." : "⚠ por debajo de la meta."}
            </p>
          </div>
        )}
      </section>

      {/* ── Por qué piden "otro look" (la carnita) ───────────────────── */}
      <section className="flex flex-col gap-3">
        <SectionTitle hint="lo que escriben al rechazar un look — dónde falla el motor">
          Por qué piden otro look
        </SectionTitle>
        {skipReasons.length === 0 ? (
          <p className="text-sm text-muted">Nadie ha dejado una razón todavía.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {skipReasons.map((reason, i) => (
              <li key={i} className="px-4 py-2.5 text-sm text-ink">
                “{reason}”
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Adopción de features ─────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <SectionTitle hint="cuántas usaron cada feature nueva">
          Adopción de features
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Avatar" value={String(conAvatar)} hint="generaron su avatar" />
          <Stat label="Esenciales" value={String(conCapsula)} hint="calcularon sus esenciales" />
          <Stat
            label="Viajes"
            value={tripsC.error ? "—" : String(tripsC.count ?? 0)}
            hint={tripsC.error ? "no disponible" : "creados en total"}
          />
          <Stat
            label="Looks de viaje 👍"
            value={tripRatio === null ? "—" : `${tripRatio}%`}
            hint={tripVotes.length > 0 ? `${tripUps}/${tripVotes.length} votos` : "sin votos"}
          />
        </div>
      </section>

      <p className="text-xs text-muted">
        {LOOKS.length} looks de swipes · {archsC.count ?? 0} básicos en catálogo
      </p>
    </div>
  );
}
