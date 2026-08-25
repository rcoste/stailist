import { createClient } from "@/lib/supabase/server";
import { LOOKS } from "@/lib/looks";
import { contarSenalOroPorCercania } from "@/lib/senal-oro";
import { contarEventos, evaluarSenales, type Veredicto } from "@/lib/senales-vivas";

/**
 * El día en que el fit check se volvió el escritor de `worn`.
 *
 * El rediseño del home (2026-08-11) mató la card "¿te lo pusiste ayer?", que
 * era el único escritor de la señal de oro, y el fit check tomó su lugar. Antes
 * de esta fecha un fit check sin `worn` es lo esperado, no un fallo.
 */
const FIT_CHECK_ESCRIBE_WORN = "2026-08-11";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
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

/**
 * Las señales que dejaron de llegar. SOLO se pinta si hay algo que decir: un
 * bloque permanente en verde entrena a saltárselo, y el día que se ponga rojo
 * nadie lo va a mirar.
 */
function SenalesRotas({ senales }: { senales: Veredicto[] }) {
  const rotas = senales.filter((s) => s.estado === "seca" || s.estado === "floja");
  if (rotas.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-error bg-surface p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-error">
          Una señal dejó de llegar
        </h2>
        <span className="text-xs text-muted">
          Estos eventos tienen que moverse juntos. Que no lo hagan casi siempre es
          código roto, no falta de uso.
        </span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {rotas.map((s) => (
          <li key={s.nombre} className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-ink">
              {s.nombre}{" "}
              <span className={s.estado === "seca" ? "text-error" : "text-warning"}>
                · {s.estado === "seca" ? "seca" : `${s.cobertura}% llega`}
              </span>
            </span>
            <span className="text-xs text-muted">{s.detalle}</span>
            <span className="text-xs text-muted">Sin esto se pierde: {s.cuesta}</span>
          </li>
        ))}
      </ul>
    </div>
  );
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
  // Ventana de la señal de oro por cercanía (ver las dos consultas de outfits).
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

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
    looksGenRes,
    fitChecksRes,
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
    // Señal de oro por cercanía (2026-08-11): looks generados y fit checks, para
    // cruzarlos en lib/senal-oro. La pregunta "¿te lo pusiste?" murió con el
    // rediseño del home; el fit check ≤24h después de un look generado es la
    // evidencia que la reemplaza (y trae foto).
    //
    // Acotadas a 90 días y no a toda la tabla: el cruce es O(fit checks × looks)
    // por persona y estas dos consultas se ejecutan en cada pintada del panel.
    // Además la métrica es de RECENCIA — un look de hace ocho meses no dice
    // nada del experimento de esta semana.
    // `source = daily`: los try-on fantasma de viaje/cápsula no son un look
    // sugerido, y colarlos haría que un try-on + un fit check contaran como
    // señal de oro.
    supabase
      .from("outfits")
      .select("user_id, created_at")
      .is("deleted_at", null)
      .eq("source", "daily")
      .gte("created_at", since90d)
      .or("gen_status.is.null,gen_status.eq.ready"),
    supabase
      .from("outfits")
      .select("user_id, created_at")
      .is("deleted_at", null)
      .eq("source", "espejo")
      .gte("created_at", since90d),
  ]);

  const estiloVisitas = estiloViewRes.data?.length ?? 0;
  const estiloPersonas = new Set(
    (estiloViewRes.data ?? []).map((e) => e.user_id as string)
  ).size;

  // ── ¿ALGUNA SEÑAL DEJÓ DE LLEGAR? ────────────────────────────────────────
  // Pares que TIENEN que moverse juntos. Ver lib/senales-vivas: los dos bugs
  // de agosto (el precalentado que se cancelaba solo y el fit check que dejó
  // de escribir `worn`) se descubrieron por casualidad con semanas de retraso,
  // y los dos se habrían visto aquí a la primera. Ventana de 30 días: con el
  // volumen de la beta, 7 días casi siempre dice "sin datos".
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: ev30 } = await supabase
    .from("events")
    .select("type, created_at, data")
    .gte("created_at", since30d)
    .in("type", ["espejo_subido", "worn", "first_outfit_ttv", "onboarding_step"]);
  const eventos = (ev30 ?? []).map((e) => ({
    type: String(e.type),
    created_at: String(e.created_at),
    data: e.data as { step?: number | string } | null,
  }));
  const senales = evaluarSenales([
    {
      nombre: "fit check → me lo puse",
      disparador: "espejo_subido",
      // DESDE EL RECABLEADO, no desde hace 30 días. El fit check se volvió el
      // escritor de `worn` el 2026-08-11 (ahí murió la card que lo preguntaba);
      // los fit checks anteriores no escribían `worn` POR DISEÑO, y contarlos
      // como fallos tenía este bloque en rojo permanente con el vínculo sano.
      desde: FIT_CHECK_ESCRIBE_WORN,
      disparos: contarEventos(eventos, "espejo_subido", FIT_CHECK_ESCRIBE_WORN),
      consecuencia: "worn",
      consecuencias: contarEventos(eventos, "worn", FIT_CHECK_ESCRIBE_WORN),
      cuesta:
        "la señal de oro del experimento, la línea más fuerte del prompt del motor y el orden del clóset por prendas usadas",
    },
    {
      nombre: "terminar onboarding → primer look",
      disparador: "onboarding_step",
      // LOS DOS LADOS EN LA MISMA VENTANA. Antes el disparador contaba perfiles
      // de TODA la historia (24) contra eventos de 30 días (11): peras contra
      // manzanas, 46% eterno. El hack de `minimo: 999` existía para tapar eso
      // —sólo silenciaba el veredicto "seca", así que el bloque seguía saliendo
      // en rojo como "floja"— y con la comparación bien hecha sobra.
      disparos: eventos.filter(
        (e) => e.type === "onboarding_step" && Number(e.data?.step) === 5
      ).length,
      consecuencia: "first_outfit_ttv",
      consecuencias: contarEventos(eventos, "first_outfit_ttv"),
      cuesta: "la medición del TTV (la promesa de <2 min)",
    },
  ]);

  const aFecha = (r: { user_id: unknown; created_at: unknown }) => ({
    userId: String(r.user_id),
    createdAt: String(r.created_at),
  });
  const senalCercania = contarSenalOroPorCercania(
    (looksGenRes.data ?? []).map(aFecha),
    (fitChecksRes.data ?? []).map(aFecha)
  );

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

      {/* ARRIBA DEL TODO cuando hay algo roto: un KPI en cero se lee como "la
          gente no lo usa" y puede significar "dejó de registrarse". Distinguir
          esas dos cosas costó dos bugs de semanas en agosto. */}
      <SenalesRotas senales={senales} />

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

      {/* Señal de oro: el "me lo puse" explícito + la cercanía (fit check ≤24h
          después de un look generado). La segunda es la que queda viva tras el
          rediseño del home — la pregunta explícita ya no existe. */}
      <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Señal de oro
        </span>
        {/* UNA sola cifra manda: los fit checks a ≤24h de un look generado.
            El total de `worn` va como contexto y en gris, porque desde que la
            card "¿te lo pusiste?" murió, casi todo `worn` viene del propio fit
            check (app/api/espejo) — enseñar las dos como si fueran evidencias
            independientes contaba lo mismo dos veces. */}
        <span className="text-base text-ink">
          {senalCercania === 0
            ? "Nadie se ha puesto un look sugerido todavía."
            : `${senalCercania} ${senalCercania === 1 ? "vez" : "veces"} que alguien se puso algo a ≤24h de que se lo sugiriéramos.`}
        </span>
        <span className="text-xs text-muted">
          {worn} {worn === 1 ? "registro" : "registros"} de uso en total (casi
          todos vienen del fit check).
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
          <div className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
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
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
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
