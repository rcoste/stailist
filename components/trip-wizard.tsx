"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { GeneratingScreen, type GenPhrase } from "@/components/generating-screen";
import { useWakeLock } from "@/lib/use-wake-lock";
import {
  OCCASIONS,
  LUGGAGE,
  tripDays,
  type Occasion,
  type Luggage,
} from "@/lib/trip";

// Modo viaje como WIZARD de 3 pasos: Tu itinerario (cadena de paradas, fusiona
// destino + fechas) → Actividades → Maleta. Overlay full-screen (oculta la tab
// bar). El Paso 1 construye la ruta como una cadena contigua: cada parada = lugar
// + noches; la llegada se encadena (salida de la anterior). El total (días ·
// noches · ruta) y fechaFin se DERIVAN. Al terminar: POST /api/trip (lugares +
// segmentos) → stream con fases → /viaje/[id]. No cambia el motor ni el contrato.

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

type Parada = { lugar: string; noches: number };

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const todayDate = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};
const firstOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
function addDaysYmd(ds: string, n: number): string {
  const d = new Date(ds + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function dmEs(ds: string): string {
  const d = new Date(ds + "T00:00:00Z");
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}
function rangeLabel(inicio: string, fin: string): string {
  if (!inicio) return "";
  if (!fin) return dmEs(inicio);
  const a = new Date(inicio + "T00:00:00Z");
  const b = new Date(fin + "T00:00:00Z");
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()} – ${b.getUTCDate()} ${MESES[b.getUTCMonth()]}`;
  }
  return `${dmEs(inicio)} – ${dmEs(fin)}`;
}
// Llegada de la parada `idx` = inicio + suma de noches de las anteriores.
function arrivalOf(inicio: string, paradas: Parada[], idx: number): string {
  if (!inicio) return "";
  let n = 0;
  for (let i = 0; i < idx; i++) n += Math.max(1, paradas[i]?.noches ?? 1);
  return addDaysYmd(inicio, n);
}
function stopRangeLabel(inicio: string, paradas: Parada[], idx: number, noches: number): string {
  const arr = arrivalOf(inicio, paradas, idx);
  if (!arr) return "";
  return rangeLabel(arr, addDaysYmd(arr, Math.max(1, noches)));
}

// ---- Sugerencias de lugar (Open-Meteo geocoding, público con CORS, debounced) ----
type Sugerencia = { nombre: string; tipo: "ciudad" | "pais"; label: string };
function usePlaceSuggestions(draft: string): Sugerencia[] {
  const [sugs, setSugs] = useState<Sugerencia[]>([]);
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
        /* sin sugerencias — el usuario puede escribir a mano */
      }
    }, 280);
    return () => clearTimeout(t);
  }, [draft]);
  return sugs;
}

export function TripWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [inicio, setInicio] = useState("");
  const [ocasiones, setOcasiones] = useState<Set<Occasion>>(new Set());
  const [maleta, setMaleta] = useState<Luggage | null>(null);
  const [phase, setPhase] = useState<"form" | "gen" | "error">("form");
  // sheet: índice de la parada a capturar (== paradas.length = nueva).
  const [sheet, setSheet] = useState<number | null>(null);
  useWakeLock(phase === "gen");

  const totalNoches = paradas.reduce((s, p) => s + Math.max(1, p.noches), 0);
  const fin = inicio && paradas.length ? addDaysYmd(inicio, totalNoches) : "";
  const lugares = paradas.map((p) => p.lugar);
  const multi = paradas.length >= 2;
  const dias = inicio && fin ? tripDays(inicio, fin) : 0;

  const canGo = step === 1 ? paradas.length >= 1 && !!inicio : true;

  function next() {
    if (step < 3) setStep((s) => (s + 1) as 1 | 2 | 3);
  }
  function back() {
    if (step === 1) router.push("/viaje/lista");
    else setStep((s) => (s - 1) as 1 | 2 | 3);
  }

  function saveParada(index: number, lugar: string, noches: number, startDate?: string) {
    if (index === 0 && startDate) setInicio(startDate);
    setParadas((prev) => {
      const nextP = [...prev];
      const p = { lugar: lugar.trim(), noches: Math.max(1, noches) };
      if (index < nextP.length) nextP[index] = p;
      else nextP.push(p);
      return nextP;
    });
    setSheet(null);
  }
  function removeParada(index: number) {
    setParadas((prev) => prev.filter((_, i) => i !== index));
  }

  async function armar() {
    if (!maleta || !inicio || !fin || paradas.length === 0) return;
    setPhase("gen");
    try {
      const res = await fetch("/api/trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lugares,
          segmentos: paradas.map((p) => ({ lugar: p.lugar, noches: p.noches })),
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
    const phrases: GenPhrase[] = [
      { a: "midiendo tus ", k: `${dias} ${dias === 1 ? "día" : "días"}`, b: "…" },
      multi
        ? { a: "viendo el clima de tus ", k: `${paradas.length} paradas`, b: "…" }
        : { a: "viendo el ", k: "clima", b: "…" },
      { a: "empacando lo que más ", k: "combina", b: "…" },
    ];
    return <GeneratingScreen phrases={phrases} />;
  }

  const meta = step === 3 ? "Paso 3 de 3 · último" : `Paso ${step} de 3`;
  const question =
    step === 1 ? "arma tu ruta" : step === 2 ? "¿qué vas a hacer?" : "¿qué maleta llevas?";
  const help =
    step === 1
      ? "Una parada o varias — la ruta se arma sola y encadenada."
      : step === 2
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
              {[0, 1, 2].map((i) => {
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
              <StepItinerario
                paradas={paradas}
                inicio={inicio}
                dias={dias}
                totalNoches={totalNoches}
                onAdd={() => setSheet(paradas.length)}
                onEdit={(i) => setSheet(i)}
                onRemove={removeParada}
              />
            ) : step === 2 ? (
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
          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              disabled={!canGo}
              className={`min-h-12 rounded-sm bg-accent text-sm font-semibold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50 ${
                step > 1 ? "flex-[2]" : "w-full"
              }`}
            >
              {step === 1 ? "Siguiente · actividades" : "Siguiente"}
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
      </div>

      {sheet !== null ? (
        <ParadaSheet
          index={sheet}
          paradas={paradas}
          inicio={inicio}
          onSave={saveParada}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {phase === "error" ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40"
          onClick={() => setPhase("form")}
        >
          <div
            className="flex w-full max-w-[430px] flex-col gap-3 rounded-t-[18px] bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-center"
            style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
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
  );
}

const ON_CARD = "border-accent bg-accent-soft shadow-[inset_0_0_0_1px_var(--c-accent)]";
const ON_ICONBOX = "bg-accent border-accent text-on-accent";

// ---- Paso 1: Tu itinerario (cadena de paradas sobre timeline) ----
function StepItinerario({
  paradas,
  inicio,
  dias,
  totalNoches,
  onAdd,
  onEdit,
  onRemove,
}: {
  paradas: Parada[];
  inicio: string;
  dias: number;
  totalNoches: number;
  onAdd: () => void;
  onEdit: (i: number) => void;
  onRemove: (i: number) => void;
}) {
  const vacio = paradas.length === 0;
  const addLabel =
    paradas.length === 0
      ? "Añade tu primera parada"
      : paradas.length === 1
        ? "¿Vas a más ciudades? Añádelas"
        : "Añadir otra parada";

  return (
    <div className="flex flex-col gap-3.5">
      {/* Total derivado */}
      <div
        className={`flex items-center gap-2.5 rounded-md border bg-surface px-[13px] py-3 ${
          vacio ? "border-dashed border-line" : "border-line"
        }`}
      >
        <span
          className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-sm ${
            vacio ? "bg-bg text-muted" : "bg-accent-soft text-accent"
          }`}
        >
          <Icon name={vacio ? "avion" : "calendario"} size={18} />
        </span>
        {vacio ? (
          <div className="min-w-0">
            <b className="block text-[13.5px] font-semibold leading-tight text-muted">
              Tu viaje, paso a paso
            </b>
            <span className="text-[11.5px] text-muted">añade tu primera parada para empezar</span>
          </div>
        ) : (
          <div className="min-w-0">
            <b className="tabular block text-[13.5px] font-semibold leading-tight text-ink">
              {dias} {dias === 1 ? "día" : "días"} · {totalNoches}{" "}
              {totalNoches === 1 ? "noche" : "noches"}
            </b>
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-muted">
              {paradas.map((p, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 ? <Icon name="flecha" size={11} className="text-accent" /> : null}
                  <b className="font-semibold text-ink">{p.lugar}</b>
                </span>
              ))}
            </span>
          </div>
        )}
      </div>

      <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
        Tu ruta, de inicio a fin
      </span>

      {/* Timeline */}
      <div className="relative pl-[30px]">
        {/* Línea conectora */}
        {!vacio ? (
          <span className="absolute bottom-[34px] left-[10px] top-[10px] w-0.5 bg-line" aria-hidden />
        ) : null}
        {paradas.map((p, i) => (
          <div key={i} className="relative mb-2">
            <span className="absolute -left-[30px] top-[13px] z-[1] flex h-[22px] w-[22px] items-center justify-center rounded-full border-[3px] border-bg bg-accent text-[11px] font-bold tabular text-on-accent">
              {i + 1}
            </span>
            <div className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-[13px] py-3">
              <button
                type="button"
                onClick={() => onEdit(i)}
                className="min-w-0 flex-1 text-left"
                aria-label={`Editar ${p.lugar}`}
              >
                <b className="block truncate text-[14.5px] font-semibold leading-tight text-ink">
                  {p.lugar}
                </b>
                <span className="tabular text-[11.5px] text-muted">
                  {stopRangeLabel(inicio, paradas, i, p.noches)} · {p.noches}{" "}
                  {p.noches === 1 ? "noche" : "noches"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`Quitar ${p.lugar}`}
                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center text-muted hover:text-ink"
              >
                <Icon name="equis" size={15} />
              </button>
            </div>
          </div>
        ))}

        {/* Nodo de añadir */}
        <div className="relative">
          <span className="absolute -left-[30px] top-[11px] z-[1] flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-dashed border-accent bg-bg text-accent">
            <Icon name="mas" size={13} strokeWidth={2} />
          </span>
          <button
            type="button"
            onClick={onAdd}
            className="flex w-full items-center gap-2.5 rounded-md border border-dashed border-line bg-surface px-[13px] py-3 text-left text-[13.5px] font-semibold text-accent transition-colors hover:border-accent"
          >
            <Icon name="mas" size={16} />
            <span className="flex min-w-0 flex-col">
              {addLabel}
              {paradas.length === 1 ? (
                <span className="text-[11px] font-normal text-muted">es opcional</span>
              ) : null}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Bottom sheet: capturar / editar una parada ----
function ParadaSheet({
  index,
  paradas,
  inicio,
  onSave,
  onClose,
}: {
  index: number;
  paradas: Parada[];
  inicio: string;
  onSave: (index: number, lugar: string, noches: number, startDate?: string) => void;
  onClose: () => void;
}) {
  const isFirst = index === 0;
  const existing = paradas[index];
  const editing = !!existing;
  const prevLugar = index > 0 ? paradas[index - 1]?.lugar : null;

  const [q, setQ] = useState(existing?.lugar ?? "");
  const [hideSugs, setHideSugs] = useState(true);
  const [noches, setNoches] = useState(existing?.noches ?? (isFirst ? 3 : 2));
  const [startDate, setStartDate] = useState(isFirst ? inicio || "" : "");

  const sugs = usePlaceSuggestions(q);
  // Llegada encadenada (no primera): salida de la parada anterior.
  const arrival = isFirst ? startDate : arrivalOf(inicio, paradas, index);
  const lugarOk = q.trim().length >= 2;
  const canSave = lugarOk && (isFirst ? !!startDate : true);

  function pick(nombre: string) {
    setQ(nombre);
    setHideSugs(true);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/25" aria-hidden />
      <div
        className="relative z-[1] flex max-h-[88dvh] w-full max-w-[430px] flex-col overflow-y-auto rounded-t-[20px] bg-surface px-[18px] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2"
        style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mx-auto my-2 h-1 w-9 shrink-0 rounded-full bg-line" aria-hidden />

        <div className="mb-3.5 flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <h2 className="display text-[21px] font-semibold leading-tight text-ink">
              {isFirst ? "Tu primera parada" : `Parada ${index + 1}`}
            </h2>
            <p className="text-xs text-muted">
              {isFirst ? "¿dónde empieza tu viaje?" : `sigues después de ${prevLugar}`}
            </p>
          </div>
          {!isFirst && prevLugar ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded-sm bg-accent-soft px-2.5 py-1 text-[11.5px] font-semibold text-accent">
              {prevLugar} <Icon name="flecha" size={12} /> aquí
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-3.5">
          {/* Lugar */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink">
              <Icon name="ubicacion" size={14} />
              {isFirst ? "¿A dónde vas?" : "¿A dónde sigues?"}
            </div>
            <label
              className={`flex items-center gap-2.5 rounded-sm border bg-bg px-[13px] py-3 transition-colors ${
                q ? "border-accent bg-surface" : "border-line focus-within:border-accent"
              }`}
            >
              <Icon name="lupa" size={17} className="shrink-0 text-muted" />
              <input
                value={q}
                autoFocus={!editing}
                onChange={(e) => {
                  setQ(e.target.value);
                  setHideSugs(false);
                }}
                placeholder="ciudad, región o país"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink caret-accent outline-none placeholder:text-muted"
              />
            </label>
            {!hideSugs && sugs.length > 0 ? (
              <div className="mt-2 overflow-hidden rounded-sm border border-line">
                {sugs.map((s, i) => (
                  <button
                    key={`${s.label}-${i}`}
                    type="button"
                    onClick={() => pick(s.nombre)}
                    className="flex w-full items-center gap-2.5 border-b border-line bg-surface px-[13px] py-3 text-left last:border-b-0"
                  >
                    <Icon
                      name={s.tipo === "pais" ? "globo" : "ubicacion"}
                      size={16}
                      className="shrink-0 text-muted"
                    />
                    <b className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
                      {s.label}
                    </b>
                    <span className="shrink-0 rounded-sm border border-line px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-muted">
                      {s.tipo === "pais" ? "país" : "ciudad"}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Fecha: calendario (primera) o llegada encadenada (siguientes) */}
          {isFirst ? (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink">
                <Icon name="calendario" size={14} />
                ¿Cuándo llegas?
              </div>
              <SingleDateCalendar value={startDate} onPick={setStartDate} />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-sm border border-line bg-bg px-[13px] py-3">
              <Icon name="calendario" size={17} className="shrink-0 text-muted" />
              <span className="text-[13.5px] font-semibold text-ink">
                Llegas el {dmEs(arrival)}
              </span>
              <span className="ml-auto rounded-sm border border-line bg-surface px-[7px] py-0.5 text-[10.5px] font-semibold text-muted">
                se encadena
              </span>
            </div>
          )}

          {/* Noches */}
          <div className="flex items-center justify-between gap-2.5">
            <div>
              <b className="block text-[13.5px] font-semibold text-ink">¿Cuántas noches?</b>
              <span className="text-[11.5px] text-muted">{q.trim() ? `en ${q.trim()}` : "aquí"}</span>
            </div>
            <Stepper
              value={noches}
              min={1}
              onMinus={() => setNoches((n) => Math.max(1, n - 1))}
              onPlus={() => setNoches((n) => n + 1)}
            />
          </div>

          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSave(index, q.trim(), noches, isFirst ? startDate : undefined)}
            className="mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-accent text-sm font-semibold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50"
          >
            <Icon name="check" size={17} />
            {editing ? "Guardar cambios" : "Añadir a mi ruta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Calendario de fecha única (≥ hoy) — para la salida del viaje (primera parada).
function SingleDateCalendar({ value, onPick }: { value: string; onPick: (ds: string) => void }) {
  const today = todayDate();
  const [view, setView] = useState(() =>
    firstOfMonth(value ? new Date(value + "T00:00:00Z") : today)
  );
  const y = view.getUTCFullYear();
  const m = view.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const firstDow = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const monthLabel = view.toLocaleDateString("es", { month: "long", year: "numeric", timeZone: "UTC" });

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(<span key={`b${i}`} />);
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = ymd(new Date(Date.UTC(y, m, day)));
    const past = ds < ymd(today);
    const on = ds === value;
    cells.push(
      <button
        key={ds}
        type="button"
        disabled={past}
        onClick={() => onPick(ds)}
        className="flex aspect-square items-center justify-center disabled:cursor-default"
      >
        <span
          className={`tabular flex h-[30px] w-[30px] items-center justify-center rounded-full text-[13px] ${
            on ? "bg-accent font-semibold text-on-accent" : past ? "text-muted/40" : "text-ink"
          }`}
        >
          {day}
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-sm border border-line bg-surface p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <b className="text-sm font-semibold capitalize text-ink">{monthLabel}</b>
        <span className="flex gap-3.5 text-muted">
          <button type="button" aria-label="Mes anterior" onClick={() => setView(new Date(Date.UTC(y, m - 1, 1)))}>
            <Icon name="chevron" size={18} rotate={180} />
          </button>
          <button type="button" aria-label="Mes siguiente" onClick={() => setView(new Date(Date.UTC(y, m + 1, 1)))}>
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
    </div>
  );
}

function Stepper({
  value,
  min = 0,
  onMinus,
  onPlus,
}: {
  value: number;
  min?: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <span className="inline-flex shrink-0 overflow-hidden rounded-sm border border-line">
      <button
        type="button"
        onClick={onMinus}
        aria-label="Menos noches"
        className="flex h-[38px] w-[38px] items-center justify-center bg-surface text-ink disabled:opacity-40"
        disabled={value <= min}
      >
        <Icon name="menos" size={16} strokeWidth={2} />
      </button>
      <span className="tabular flex h-[38px] w-10 items-center justify-center border-x border-line text-[15px] font-semibold">
        {value}
      </span>
      <button
        type="button"
        onClick={onPlus}
        aria-label="Más noches"
        className="flex h-[38px] w-[38px] items-center justify-center bg-surface text-ink"
      >
        <Icon name="mas" size={16} strokeWidth={2} />
      </button>
    </span>
  );
}

// ---- Paso 2: Actividades (multi-select con palomita, icono arriba) ----
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
        const full = i === OCCASIONS.length - 1;
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

// ---- Paso 3: Maleta (single-select, una por renglón + capacidad) ----
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
              <b className={`tabular block text-[13px] font-semibold ${on ? "text-accent" : "text-ink"}`}>
                ~{l.maxPiezas}
              </b>
              <span className="text-[10.5px] text-muted">piezas</span>
            </span>
          </button>
        );
      })}
      <div className="flex items-start gap-2 text-xs leading-snug text-muted">
        <Icon name="destello" size={15} className="mt-px shrink-0 text-accent" />
        <span>Es un techo, no una meta: armo lo mínimo que combina. Si cabe menos, mejor.</span>
      </div>
    </div>
  );
}
