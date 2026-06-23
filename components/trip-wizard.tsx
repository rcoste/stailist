"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { GeneratingScreen, type GenPhrase } from "@/components/generating-screen";
import {
  OCCASIONS,
  LUGGAGE,
  tripDays,
  tripNights,
  splitNights,
  type Occasion,
  type Luggage,
} from "@/lib/trip";

// Modo viaje como WIZARD de 4 pasos (handoff viaje-final): Destino (multi-lugar) →
// Fechas (calendario + "por lugar") → Actividades → Maleta. Overlay full-screen
// (oculta la tab bar). Al terminar: POST /api/trip (lugares + segmentos) → stream
// con fases → navega al resultado /viaje/[id]. No cambia el motor ni el contrato
// de streaming (solo `lugares`).

const ACT_ICON: Record<Occasion, IconName> = {
  playa: "playa",
  ciudad: "ciudad",
  trabajo: "maletin",
  noche: "luna",
  aire: "hoja",
};
const LUG_ICON: Record<Luggage, IconName> = {
  mochila: "mochila",
  mano: "maletin",
  documentada: "maleta",
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const todayDate = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};
const firstOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

export function TripWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [lugares, setLugares] = useState<string[]>([]);
  const [dateMode, setDateMode] = useState<"una" | "lugar">("una");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [noches, setNoches] = useState<number[]>([]);
  const [nochesKey, setNochesKey] = useState("");
  const [ocasiones, setOcasiones] = useState<Set<Occasion>>(new Set());
  const [maleta, setMaleta] = useState<Luggage | null>(null);
  const [phase, setPhase] = useState<"form" | "gen" | "error">("form");

  const totalNoches = inicio && fin ? tripNights(inicio, fin) : 0;
  const multi = lugares.length >= 2;

  // Re-balancea el reparto de noches cuando cambia #paradas o el total (patrón de
  // "ajustar estado en el render" de React). El usuario lo afina con los steppers.
  const nk = `${lugares.length}:${totalNoches}`;
  if (nk !== nochesKey) {
    setNochesKey(nk);
    setNoches(splitNights(totalNoches, lugares.length));
  }

  const canGo =
    step === 1
      ? lugares.length >= 1
      : step === 2
        ? !!inicio && !!fin && fin >= inicio
        : true; // paso 3 (actividades) puede ir vacío; paso 4 valida en el CTA

  function next() {
    if (step < 4) setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
  }
  function back() {
    // Paso 1 sale a "Tus viajes" (que sí tiene tab bar, para no dejar al usuario
    // atrapado en el overlay). Pasos 2-4 retroceden un paso.
    if (step === 1) router.push("/viaje/lista");
    else setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
  }

  async function armar() {
    if (!maleta || !inicio || !fin) return;
    setPhase("gen");
    const segmentos =
      dateMode === "lugar" && multi
        ? lugares.map((l, i) => ({ lugar: l, noches: noches[i] ?? 0 }))
        : undefined;
    try {
      const res = await fetch("/api/trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lugares,
          ...(segmentos ? { segmentos } : {}),
          fechaInicio: inicio,
          fechaFin: fin,
          ocasiones: [...ocasiones],
          maleta,
        }),
      });
      if (!res.ok || !res.body) {
        setPhase("error");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);
          if (evt.error) {
            setPhase("error");
            return;
          } else if (evt.done) {
            router.push(`/viaje/${evt.tripId}`);
            return;
          }
        }
      }
      setPhase("error");
    } catch {
      setPhase("error");
    }
  }

  if (phase === "gen") {
    const days = tripDays(inicio, fin);
    const phrases: GenPhrase[] = [
      { a: "midiendo tus ", k: `${days} ${days === 1 ? "día" : "días"}`, b: "…" },
      multi
        ? { a: "viendo el clima de tus ", k: `${lugares.length} paradas`, b: "…" }
        : { a: "viendo el ", k: "clima", b: "…" },
      { a: "empacando lo que más ", k: "combina", b: "…" },
    ];
    return <GeneratingScreen phrases={phrases} />;
  }

  const meta = step === 4 ? "Paso 4 de 4 · último" : `Paso ${step} de 4`;
  const question =
    step === 1
      ? "¿a dónde vas?"
      : step === 2
        ? "¿qué días?"
        : step === 3
          ? "¿qué vas a hacer?"
          : "¿qué maleta llevas?";
  const help =
    step === 1
      ? "Una o varias paradas — ciudad, región o país."
      : step === 3
        ? "Marca todo lo que aplique — combino para cada plan."
        : null;

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <div className="mx-auto flex h-full max-w-[430px] flex-col">
        {/* Header del paso */}
        <div className="px-[18px] pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={back}
              className="flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
            >
              <Icon name="chevron" size={15} rotate={180} />
              {step === 1 ? "Tus viajes" : "Atrás"}
            </button>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map((i) => {
                const idx = step - 1;
                return (
                  <span
                    key={i}
                    className={`h-[7px] rounded-full transition-all duration-200 ${
                      i === idx ? "w-5 bg-accent" : i < idx ? "w-[7px] bg-accent" : "w-[7px] bg-line"
                    }`}
                  />
                );
              })}
            </div>
          </div>
          <p className="mt-[18px] text-[11.5px] font-medium text-muted">{meta}</p>
          <h1 className="mt-[7px] display text-[26px] font-semibold leading-[1.12] tracking-[-0.01em] text-ink">
            {question}
          </h1>
          {help ? <p className="mt-2 text-[12.5px] leading-snug text-muted">{help}</p> : null}
        </div>

        {/* Cuerpo scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-4 pt-4">
          <div key={step} style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}>
            {step === 1 ? (
              <StepDestino lugares={lugares} onChange={setLugares} />
            ) : step === 2 ? (
              <StepFechas
                multi={multi}
                lugares={lugares}
                dateMode={dateMode}
                onMode={setDateMode}
                inicio={inicio}
                fin={fin}
                onRange={(i, f) => {
                  setInicio(i);
                  setFin(f);
                }}
                noches={noches}
                onNoches={setNoches}
                totalNoches={totalNoches}
              />
            ) : step === 3 ? (
              <StepActividades
                value={ocasiones}
                onToggle={(o) =>
                  setOcasiones((prev) => {
                    const n = new Set(prev);
                    if (n.has(o)) n.delete(o);
                    else n.add(o);
                    return n;
                  })
                }
              />
            ) : (
              <StepMaleta value={maleta} onPick={setMaleta} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-none gap-2.5 border-t border-line bg-surface px-[18px] pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={back}
              className="min-h-12 flex-1 rounded-sm border border-line bg-surface text-sm font-semibold text-ink transition-colors hover:border-ink"
            >
              Atrás
            </button>
          ) : null}
          {step < 4 ? (
            <button
              type="button"
              onClick={next}
              disabled={!canGo}
              className={`min-h-12 rounded-sm bg-accent text-sm font-semibold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50 ${
                step > 1 ? "flex-[2]" : "w-full"
              }`}
            >
              Siguiente
            </button>
          ) : (
            <button
              type="button"
              onClick={armar}
              disabled={!maleta}
              className="flex min-h-12 flex-[2] items-center justify-center gap-2 rounded-sm bg-accent text-sm font-semibold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50"
            >
              <Icon name="destello" size={18} />
              Armar mi maleta
            </button>
          )}
        </div>

        {phase === "error" ? (
          <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 px-4 pb-4"
            onClick={() => setPhase("form")}
          >
            <div
              className="flex w-full max-w-[430px] flex-col gap-3 rounded-2xl bg-surface p-5 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm text-error">No pude armar tu maleta — inténtalo de nuevo.</p>
              <button
                type="button"
                onClick={() => setPhase("form")}
                className="min-h-11 rounded-sm border border-line bg-surface text-sm font-medium text-ink"
              >
                Entendido
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const ON_CARD = "border-accent bg-accent-soft shadow-[inset_0_0_0_1px_var(--c-accent)]";
const ON_ICONBOX = "bg-accent border-accent text-on-accent";

// ---- Paso 1: Destino (tags multi-lugar + sugerencias de geocoding) ----
type Sugerencia = { nombre: string; tipo: "ciudad" | "pais"; label: string };

function StepDestino({
  lugares,
  onChange,
}: {
  lugares: string[];
  onChange: (l: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sugs, setSugs] = useState<Sugerencia[]>([]);

  // Sugerencias en vivo desde Open-Meteo geocoding (público, con CORS), debounced.
  useEffect(() => {
    const q = draft.trim();
    const t = setTimeout(async () => {
      if (q.length < 2) {
        setSugs([]);
        return;
      }
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            q
          )}&count=5&language=es&format=json`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (!res.ok) return;
        const data = await res.json();
        const results = (data?.results ?? []) as {
          name: string;
          admin1?: string;
          country?: string;
          feature_code?: string;
        }[];
        setSugs(
          results.map((r) => {
            const esPais = (r.feature_code ?? "").startsWith("PCL") || r.country === r.name;
            return {
              nombre: r.name,
              tipo: esPais ? "pais" : "ciudad",
              label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
            };
          })
        );
      } catch {
        /* sin sugerencias — el usuario puede agregar a mano */
      }
    }, 280);
    return () => clearTimeout(t);
  }, [draft]);

  function add(nombre: string) {
    const n = nombre.trim();
    if (n.length < 2 || lugares.includes(n) || lugares.length >= 6) return;
    onChange([...lugares, n]);
    setDraft("");
    setSugs([]);
  }
  function remove(i: number) {
    onChange(lugares.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Campo de tags */}
      <label
        className={`flex flex-wrap items-center gap-[7px] rounded-sm border bg-surface px-3 py-[11px] transition-colors ${
          lugares.length > 0 || draft ? "border-accent" : "border-line focus-within:border-accent"
        }`}
      >
        <Icon name="lupa" size={18} className="shrink-0 text-accent" />
        {lugares.map((l, i) => (
          <span
            key={`${l}-${i}`}
            className="inline-flex items-center gap-[7px] rounded-sm border border-accent bg-accent-soft py-1.5 pl-2.5 pr-2 text-[13px] font-semibold text-accent"
          >
            {l}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Quitar ${l}`}
              className="opacity-65"
            >
              <Icon name="equis" size={13} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && lugares.length) {
              remove(lugares.length - 1);
            }
          }}
          placeholder={lugares.length ? "" : "ciudad, región o país"}
          className="min-w-[8ch] flex-1 bg-transparent text-[13.5px] text-ink caret-accent outline-none placeholder:text-muted"
        />
      </label>

      {sugs.length > 0 ? (
        <div className="flex flex-col">
          <span className="mx-0.5 mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
            Agregar otro
          </span>
          {sugs.map((s, i) => (
            <button
              key={`${s.label}-${i}`}
              type="button"
              onClick={() => add(s.nombre)}
              className="flex items-center gap-[11px] border-b border-line px-1.5 py-3 text-left last:border-b-0"
            >
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-sm border border-line bg-bg text-muted">
                <Icon name={s.tipo === "pais" ? "globo" : "ubicacion"} size={16} />
              </span>
              <b className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{s.label}</b>
              <span className="shrink-0 rounded-sm border border-line px-[7px] py-[3px] text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
                {s.tipo === "pais" ? "país" : "ciudad"}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---- Paso 2: Fechas (toggle + presets + calendario + reparto por lugar) ----
function StepFechas({
  multi,
  lugares,
  dateMode,
  onMode,
  inicio,
  fin,
  onRange,
  noches,
  onNoches,
  totalNoches,
}: {
  multi: boolean;
  lugares: string[];
  dateMode: "una" | "lugar";
  onMode: (m: "una" | "lugar") => void;
  inicio: string;
  fin: string;
  onRange: (inicio: string, fin: string) => void;
  noches: number[];
  onNoches: (n: number[]) => void;
  totalNoches: number;
}) {
  const porLugar = multi && dateMode === "lugar";
  const sumNoches = noches.reduce((s, n) => s + n, 0);

  function setStop(i: number, delta: number) {
    const n = [...noches];
    n[i] = Math.max(0, (n[i] ?? 0) + delta);
    onNoches(n);
  }

  return (
    <div className="flex flex-col gap-3.5">
      {multi ? (
        <Segmented
          options={[
            { v: "una", label: "Una fecha", icon: "calendario" },
            { v: "lugar", label: "Por lugar", icon: "ubicacion" },
          ]}
          value={dateMode}
          onPick={(v) => onMode(v as "una" | "lugar")}
        />
      ) : null}

      {!porLugar ? (
        <>
          <Presets inicio={inicio} fin={fin} onRange={onRange} />
          <Calendar inicio={inicio} fin={fin} onRange={onRange} />
          {multi ? (
            <div className="flex flex-col gap-[7px]">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                Tus {lugares.length} paradas
              </span>
              <div className="flex flex-wrap gap-[7px]">
                {lugares.map((l, i) => (
                  <span
                    key={`${l}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-bg px-2.5 py-1.5 text-[12.5px] font-semibold text-muted"
                  >
                    <Icon name="ubicacion" size={13} />
                    {l}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-[13px] py-3">
            <Icon name="calendario" size={18} className="shrink-0 text-accent" />
            <div className="flex-1">
              <b className="text-[13.5px] font-semibold text-ink">{rangeLabel(inicio, fin)}</b>{" "}
              <span className="tabular text-[11.5px] text-muted">
                · {tripDays(inicio, fin)} días · {totalNoches} noches
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
              Reparte tus noches
            </span>
            {lugares.map((l, i) => {
              const fechas = parteFechas(inicio, noches, i);
              return (
                <div
                  key={`${l}-${i}`}
                  className="flex items-center gap-[11px] rounded-md border border-line bg-surface px-3 py-[11px]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-line bg-bg text-accent">
                    <Icon name="ubicacion" size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[13.5px] font-semibold leading-tight text-ink">
                      {l}
                    </b>
                    <span className="tabular text-[11.5px] text-muted">{fechas}</span>
                  </div>
                  <Stepper
                    value={noches[i] ?? 0}
                    onMinus={() => setStop(i, -1)}
                    onPlus={() => setStop(i, 1)}
                  />
                </div>
              );
            })}
            <div className="flex items-center gap-2.5">
              <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full rounded-full ${sumNoches === totalNoches ? "bg-success" : "bg-accent"}`}
                  style={{ width: `${totalNoches ? Math.min(100, (sumNoches / totalNoches) * 100) : 0}%` }}
                />
              </div>
              <span
                className={`flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold ${
                  sumNoches === totalNoches ? "text-success" : "text-muted"
                }`}
              >
                {sumNoches === totalNoches ? <Icon name="check" size={14} /> : null}
                <span className="tabular">
                  {sumNoches} de {totalNoches} noches
                </span>
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-md border border-line bg-surface px-[13px] py-3">
            <Icon name="termo" size={18} className="mt-0.5 shrink-0 text-accent" />
            <div>
              <b className="block text-[12.5px] font-semibold text-ink">
                Esto me deja afinar por parada
              </b>
              <span className="text-[11.5px] leading-snug text-muted">
                El clima de cada lugar y cuánta ropa de cada plan. Para la maleta basta una fecha —
                esto es el extra.
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Segmented({
  options,
  value,
  onPick,
}: {
  options: { v: string; label: string; icon: IconName }[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="inline-flex self-start overflow-hidden rounded-sm border border-line">
      {options.map((o, i) => {
        const on = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onPick(o.v)}
            className={`flex items-center gap-1.5 px-[15px] py-2.5 text-[12.5px] font-semibold transition-colors ${
              i > 0 ? "border-l border-line" : ""
            } ${on ? "bg-accent-soft text-accent" : "bg-surface text-ink"}`}
          >
            <Icon name={o.icon} size={16} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({
  value,
  onMinus,
  onPlus,
}: {
  value: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <span className="inline-flex shrink-0 overflow-hidden rounded-sm border border-line">
      <button
        type="button"
        onClick={onMinus}
        aria-label="Menos noches"
        className="flex h-8 w-8 items-center justify-center bg-surface text-ink disabled:opacity-40"
        disabled={value <= 0}
      >
        <Icon name="menos" size={16} strokeWidth={2} />
      </button>
      <span className="tabular flex h-8 w-[30px] items-center justify-center border-x border-line text-sm font-semibold">
        {value}
      </span>
      <button
        type="button"
        onClick={onPlus}
        aria-label="Más noches"
        className="flex h-8 w-8 items-center justify-center bg-surface text-ink"
      >
        <Icon name="mas" size={16} strokeWidth={2} />
      </button>
    </span>
  );
}

function Presets({
  inicio,
  fin,
  onRange,
}: {
  inicio: string;
  fin: string;
  onRange: (i: string, f: string) => void;
}) {
  const presets = useMemo(() => {
    const base = todayDate();
    const addDays = (n: number) => {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + n);
      return d;
    };
    // Próximo sábado (0=domingo … 6=sábado).
    const dow = base.getUTCDay();
    const toSat = (6 - dow + 7) % 7 || 7;
    const sat = addDays(toSat);
    const sun = new Date(sat);
    sun.setUTCDate(sun.getUTCDate() + 1);
    // Próximo viernes para el puente.
    const toFri = (5 - dow + 7) % 7 || 7;
    const fri = addDays(toFri);
    const mon = new Date(fri);
    mon.setUTCDate(mon.getUTCDate() + 3);
    const semFin = addDays(7);
    return [
      { label: "Este finde", i: ymd(sat), f: ymd(sun) },
      { label: "Una semana", i: ymd(base), f: ymd(semFin) },
      { label: "Puente largo", i: ymd(fri), f: ymd(mon) },
    ];
  }, []);

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((p) => {
        const on = inicio === p.i && fin === p.f;
        return (
          <button
            key={p.label}
            type="button"
            onClick={() => onRange(p.i, p.f)}
            className={`rounded-sm border px-[13px] py-2.5 text-[12.5px] font-semibold transition-colors ${
              on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// Calendario de rango: navegación de mes, selección de inicio/fin, banda intermedia.
function Calendar({
  inicio,
  fin,
  onRange,
}: {
  inicio: string;
  fin: string;
  onRange: (i: string, f: string) => void;
}) {
  const today = todayDate();
  const [view, setView] = useState(() => firstOfMonth(inicio ? new Date(inicio + "T00:00:00Z") : today));

  const y = view.getUTCFullYear();
  const m = view.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  // Offset lunes-primero: getUTCDay 0=dom → 6, 1=lun → 0 …
  const firstDow = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const monthLabel = view.toLocaleDateString("es", { month: "long", year: "numeric", timeZone: "UTC" });

  function pick(day: number) {
    const ds = ymd(new Date(Date.UTC(y, m, day)));
    if (ds < ymd(today)) return; // no pasado
    if (!inicio || (inicio && fin)) {
      onRange(ds, "");
    } else if (ds < inicio) {
      onRange(ds, "");
    } else {
      onRange(inicio, ds);
    }
  }

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(<span key={`b${i}`} />);
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = ymd(new Date(Date.UTC(y, m, day)));
    const past = ds < ymd(today);
    const isStart = ds === inicio;
    const isEnd = ds === fin && fin !== "";
    const inRange = fin && ds > inicio && ds < fin;
    const bandClass = isStart && fin ? "band-start" : isEnd ? "band-end" : inRange ? "band-mid" : "";
    cells.push(
      <button
        key={ds}
        type="button"
        disabled={past}
        onClick={() => pick(day)}
        className="relative flex aspect-square items-center justify-center disabled:cursor-default"
      >
        {bandClass === "band-mid" ? <span className="absolute inset-0 bg-accent-soft" /> : null}
        {bandClass === "band-start" ? (
          <span className="absolute inset-y-0 right-0 w-1/2 bg-accent-soft" />
        ) : null}
        {bandClass === "band-end" ? (
          <span className="absolute inset-y-0 left-0 w-1/2 bg-accent-soft" />
        ) : null}
        <span
          className={`tabular relative z-[1] flex h-[30px] w-[30px] items-center justify-center rounded-full text-[13px] ${
            isStart || isEnd
              ? "bg-accent font-semibold text-on-accent"
              : past
                ? "text-muted/40"
                : "text-ink"
          }`}
        >
          {day}
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-md border border-line bg-surface p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <b className="text-sm font-semibold text-ink">{monthLabel}</b>
        <span className="flex gap-3.5 text-muted">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => setView(new Date(Date.UTC(y, m - 1, 1)))}
          >
            <Icon name="chevron" size={18} rotate={180} />
          </button>
          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() => setView(new Date(Date.UTC(y, m + 1, 1)))}
          >
            <Icon name="chevron" size={18} />
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7">
        {["L", "M", "M", "J", "V", "S", "D"].map((w, i) => (
          <span key={i} className="pb-2 text-center text-[10.5px] font-semibold text-muted">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">{cells}</div>
      {inicio && fin ? (
        <div className="mt-3 text-center text-[13.5px]">
          <b className="font-semibold text-ink">{tripDays(inicio, fin)} días</b>{" "}
          <span className="text-muted">
            · {rangeLabel(inicio, fin)} · {tripNights(inicio, fin)} noches
          </span>
        </div>
      ) : (
        <div className="mt-3 text-center text-[12.5px] text-muted">
          {inicio ? "Elige la fecha de regreso" : "Elige tus fechas"}
        </div>
      )}
    </div>
  );
}

// ---- Paso 3: Actividades (multi-select con palomita, icono arriba) ----
function StepActividades({
  value,
  onToggle,
}: {
  value: Set<Occasion>;
  onToggle: (o: Occasion) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-[11px]">
      {OCCASIONS.map((o, i) => {
        const on = value.has(o.value);
        const full = i === OCCASIONS.length - 1; // la 5ª full-width
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            aria-pressed={on}
            className={`relative flex flex-col items-center justify-center gap-3 rounded-md border bg-surface p-[14px] text-center transition-colors ${
              full ? "col-span-2 min-h-[96px]" : "min-h-[138px]"
            } ${on ? ON_CARD : "border-line hover:border-ink"}`}
          >
            <span
              className={`absolute right-[11px] top-[11px] flex h-5 w-5 items-center justify-center rounded-sm border transition-colors ${
                on ? "border-accent bg-accent text-on-accent" : "border-line"
              }`}
            >
              {on ? <Icon name="check" size={13} strokeWidth={2.2} /> : null}
            </span>
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-sm border transition-colors ${
                on ? ON_ICONBOX : "border-line bg-bg text-ink"
              }`}
            >
              <Icon name={ACT_ICON[o.value]} size={24} />
            </span>
            <b className={`text-[14.5px] font-semibold leading-tight ${on ? "text-accent" : "text-ink"}`}>
              {o.label}
            </b>
          </button>
        );
      })}
    </div>
  );
}

// ---- Paso 4: Maleta (single-select, una por renglón + capacidad) ----
function StepMaleta({
  value,
  onPick,
}: {
  value: Luggage | null;
  onPick: (l: Luggage) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {LUGGAGE.map((l) => {
        const on = value === l.value;
        return (
          <button
            key={l.value}
            type="button"
            onClick={() => onPick(l.value)}
            aria-pressed={on}
            className={`flex items-center gap-3.5 rounded-md border bg-surface p-4 text-left transition-colors ${
              on ? ON_CARD : "border-line hover:border-ink"
            }`}
          >
            <span
              className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-sm border transition-colors ${
                on ? ON_ICONBOX : "border-line bg-bg text-ink"
              }`}
            >
              <Icon name={LUG_ICON[l.value]} size={24} />
            </span>
            <span className="min-w-0 flex-1">
              <b className={`block text-[15px] font-semibold ${on ? "text-accent" : "text-ink"}`}>
                {l.label}
              </b>
              <span className="text-xs text-muted">{l.hint}</span>
            </span>
            <span className="shrink-0 text-right">
              <b
                className={`tabular block text-[13px] font-semibold ${on ? "text-accent" : "text-ink"}`}
              >
                ~{l.maxPiezas}
              </b>
              <span className="text-[10.5px] text-muted">piezas</span>
            </span>
          </button>
        );
      })}
      <div className="flex items-start gap-2 text-xs leading-snug text-muted">
        <Icon name="destello" size={15} className="mt-px shrink-0 text-accent" />
        <span>
          Es un techo, no una meta: armo lo mínimo que combina. Si cabe menos, mejor.
        </span>
      </div>
    </div>
  );
}

// ---- helpers de fecha (display) ----
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function dmEs(ds: string): string {
  const d = new Date(ds + "T00:00:00Z");
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}
function rangeLabel(inicio: string, fin: string): string {
  if (!inicio) return "Elige tus fechas";
  if (!fin) return dmEs(inicio);
  const a = new Date(inicio + "T00:00:00Z");
  const b = new Date(fin + "T00:00:00Z");
  // Mismo mes → "17 – 24 nov"; distinto → "28 nov – 3 dic".
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()} – ${b.getUTCDate()} ${MESES[b.getUTCMonth()]}`;
  }
  return `${dmEs(inicio)} – ${dmEs(fin)}`;
}
// Fechas derivadas de una parada en el modo "por lugar".
function parteFechas(inicio: string, noches: number[], idx: number): string {
  if (!inicio) return "";
  const start = new Date(inicio + "T00:00:00Z");
  for (let i = 0; i < idx; i++) start.setUTCDate(start.getUTCDate() + Math.max(1, noches[i] ?? 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + Math.max(1, noches[idx] ?? 0));
  return `${dmEs(ymd(start))} – ${dmEs(ymd(end))}`;
}
