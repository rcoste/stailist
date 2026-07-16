"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Icon, type IconName } from "@/components/icon";
import type { ClosetPick } from "@/components/weather-picker";
import { GeneratingScreen, type GenPhrase } from "@/components/generating-screen";
import { useWakeLock } from "@/lib/use-wake-lock";
import { comprimir } from "@/lib/image-compress";
import { toUsableImage } from "@/lib/image-file";
import {
  OCCASIONS,
  LUGGAGE,
  tripDays,
  bolsasCount,
  luggageCapacity,
  type Bolsas,
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
  traslado: "avion",
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
// Noches entre dos fechas ymd (fin − inicio, en días).
function diffDays(a: string, b: string): number {
  return Math.round(
    (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000
  );
}
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

// Tope de anclas: el valor es que el motor complete ALREDEDOR de tus elegidas.
// Con más, ya no empaca el stylist — empacas tú y el motor decora.
const MAX_ANCLAS = 4;

export function TripWizard({ closet = [] }: { closet?: ClosetPick[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [inicio, setInicio] = useState("");
  const [ocasiones, setOcasiones] = useState<Set<Occasion>>(new Set());
  // Anclas: prendas del clóset que la persona QUIERE llevar sí o sí (opcional).
  const [anclas, setAnclas] = useState<ClosetPick[]>([]);
  const [anclasOpen, setAnclasOpen] = useState(false);
  // Texto libre "¿algo especial de este viaje?" (mismo espíritu que el "¿algo en
  // mente?" de Hoy). Afina la cápsula y los looks a lo que la persona va a hacer.
  const [contexto, setContexto] = useState("");
  // Itinerario por screenshot: la visión PRE-LLENA la ruta; el wizard es la
  // pantalla de confirmación (nada se genera hasta que la persona sigue).
  const itinRef = useRef<HTMLInputElement>(null);
  const [itinBusy, setItinBusy] = useState(false);
  const [itinError, setItinError] = useState<string | null>(null);
  const [itinInfo, setItinInfo] = useState<{
    descartadas: { lugar: string; razon: string }[];
    confianza: string;
  } | null>(null);

  async function leerItinerario(file: File) {
    setItinBusy(true);
    setItinError(null);
    setItinInfo(null);
    try {
      // toUsableImage: si fotografió el itinerario con un iPhone viene en HEIC.
      const blob = await comprimir(await toUsableImage(file), 1600, 0.92);
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(new Error("read"));
        r.readAsDataURL(blob);
      });
      const res = await fetch("/api/trip/itinerario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok || !d.paradas?.length) {
        setItinError(
          d?.problema || "no alcancé a leer esa captura — ¿tienes una más nítida?"
        );
        return;
      }
      setParadas(d.paradas);
      if (d.fechaInicio) setInicio(d.fechaInicio);
      setItinInfo({ descartadas: d.descartadas ?? [], confianza: d.confianza });
    } catch {
      setItinError("no alcancé a leer esa captura — ¿tienes una más nítida?");
    } finally {
      setItinBusy(false);
    }
  }
  // Multi-maleta: cantidades por tipo. Default 1 carry-on (lo más común).
  const [bolsas, setBolsas] = useState<Bolsas>({ mano: 1 });
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
    if (bolsasCount(bolsas) === 0 || !inicio || !fin || paradas.length === 0) return;
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
          bolsas,
          anclas: anclas.map((a) => a.id),
          contexto: contexto.trim() || undefined,
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
              {step === 1 ? "tus viajes" : "atrás"}
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
          <p className="mt-[18px] text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{meta}</p>
          <h1 className="mt-[7px] text-[26px] font-semibold leading-[1.12] tracking-[-0.01em] text-ink">
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
                onSubirItinerario={() => itinRef.current?.click()}
                itinBusy={itinBusy}
                itinError={itinError}
                itinInfo={itinInfo}
              />
            ) : step === 2 ? (
              <>
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
                {closet.length > 0 ? (
                  <AnclasSection
                    anclas={anclas}
                    onOpen={() => setAnclasOpen(true)}
                    onRemove={(id) => setAnclas((prev) => prev.filter((a) => a.id !== id))}
                  />
                ) : null}
                <ContextoField value={contexto} onChange={setContexto} />
              </>
            ) : (
              <StepMaleta bolsas={bolsas} onChange={setBolsas} />
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
              atrás
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
              {step === 1 ? "siguiente · actividades" : "siguiente"}
            </button>
          ) : (
            <button
              type="button"
              onClick={armar}
              disabled={bolsasCount(bolsas) === 0}
              className="flex min-h-12 flex-[2] items-center justify-center gap-2 rounded-sm bg-accent text-sm font-semibold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50"
            >
              <Icon name="destello" size={18} />
              armar mi maleta
            </button>
          )}
        </div>
      </div>

      {/* Input oculto del itinerario (lo dispara el botón del paso 1). */}
      <input
        ref={itinRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // permite re-elegir la misma captura
          if (f) void leerItinerario(f);
        }}
      />

      {sheet !== null ? (
        <ParadaSheet
          index={sheet}
          paradas={paradas}
          inicio={inicio}
          onSave={saveParada}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {anclasOpen ? (
        <AnclasSheet
          closet={closet}
          selected={anclas}
          onToggle={(p) =>
            setAnclas((prev) => {
              if (prev.some((a) => a.id === p.id)) return prev.filter((a) => a.id !== p.id);
              if (prev.length >= MAX_ANCLAS) return prev;
              return [...prev, p];
            })
          }
          onClose={() => setAnclasOpen(false)}
        />
      ) : null}

      {phase === "error" ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center lg:items-center bg-ink/40"
          onClick={() => setPhase("form")}
        >
          <div
            className="flex w-full max-w-[430px] flex-col gap-3 rounded-t-[18px] lg:rounded-[18px] bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-center"
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
  onSubirItinerario,
  itinBusy,
  itinError,
  itinInfo,
}: {
  paradas: Parada[];
  inicio: string;
  dias: number;
  totalNoches: number;
  onAdd: () => void;
  onEdit: (i: number) => void;
  onRemove: (i: number) => void;
  onSubirItinerario: () => void;
  itinBusy: boolean;
  itinError: string | null;
  itinInfo: { descartadas: { lugar: string; razon: string }[]; confianza: string } | null;
}) {
  const vacio = paradas.length === 0;
  const addLabel =
    paradas.length === 0
      ? "añade tu primera parada"
      : paradas.length === 1
        ? "¿vas a más ciudades? añádelas"
        : "añadir otra parada";

  return (
    <div className="flex flex-col gap-3.5">
      {/* Confirmación de lo leído del itinerario: la ruta ya quedó pre-llenada
          abajo, esto solo avisa que es una LECTURA y hay que revisarla. */}
      {itinInfo ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-accent bg-accent-soft px-[13px] py-3">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-accent">
            <Icon name="check" size={13} strokeWidth={2.2} />
            esto entendí de tu itinerario
          </span>
          <p className="text-[12.5px] leading-snug text-ink">
            revísalo antes de seguir — puedes editar o quitar cualquier parada.
          </p>
          {itinInfo.descartadas.length > 0 ? (
            <p className="text-[11.5px] leading-snug text-muted">
              no conté{" "}
              {itinInfo.descartadas.map((d, i) => (
                <span key={i}>
                  {i > 0 ? " ni " : ""}
                  <b className="font-semibold text-ink">{d.lugar}</b>
                  {d.razon ? ` (${d.razon.toLowerCase()})` : ""}
                </span>
              ))}
              .
            </p>
          ) : null}
          {itinInfo.confianza === "baja" ? (
            <p className="text-[11.5px] leading-snug text-warning">
              la captura no estaba muy clara — revisa bien las fechas.
            </p>
          ) : null}
        </div>
      ) : null}

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
              tu viaje, paso a paso
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

      {/* Atajo: leer el itinerario de una captura y pre-llenar la ruta. Solo en
          vacío — una vez que hay paradas, el camino es editarlas a mano. */}
      {vacio ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onSubirItinerario}
            disabled={itinBusy}
            className="flex min-h-12 items-center justify-center gap-2 rounded-sm border border-line bg-surface text-[13px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-60"
          >
            <Icon name="camara" size={16} />
            <span className={itinBusy ? "shimmer-txt" : undefined}>
              {itinBusy ? "leyendo tu itinerario…" : "o sube tu itinerario y lo leo"}
            </span>
          </button>
          <p className="text-center text-[11px] leading-snug text-muted">
            {itinError ? (
              <span className="text-error">{itinError}</span>
            ) : (
              "una captura de tu vuelo y te lleno la ruta — tú la confirmas"
            )}
          </p>
        </div>
      ) : null}
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
  // Solo la 1ª parada elige fecha: con 2 formas (toggle). En "rango" se setea
  // inicio+fin (noches = diff); en "días" se setea inicio + stepper de noches.
  const [modo, setModo] = useState<"rango" | "dias">("rango");
  const [endDate, setEndDate] = useState(
    isFirst && existing?.noches && (inicio || "")
      ? addDaysYmd(inicio, existing.noches)
      : ""
  );

  const sugs = usePlaceSuggestions(q);
  // Llegada encadenada (no primera): salida de la parada anterior.
  const arrival = isFirst ? startDate : arrivalOf(inicio, paradas, index);
  const lugarOk = q.trim().length >= 2;
  // Noches efectivas: en la 1ª parada salen del calendario (rango = diff, días =
  // stepper); en las encadenadas, del stepper de noches.
  const rangoOk = !!startDate && !!endDate && endDate > startDate;
  const effNoches = !isFirst
    ? noches
    : modo === "rango"
      ? (rangoOk ? diffDays(startDate, endDate) : 0)
      : noches;
  const canSave =
    lugarOk &&
    (!isFirst
      ? true
      : modo === "rango"
        ? rangoOk
        : !!startDate && effNoches >= 1);

  function pick(nombre: string) {
    setQ(nombre);
    setHideSugs(true);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center lg:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/25" aria-hidden />
      <div
        className="relative z-[1] flex max-h-[88dvh] w-full max-w-[430px] flex-col overflow-y-auto rounded-t-[20px] bg-surface px-[18px] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2"
        style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mx-auto my-2 h-1 w-9 shrink-0 rounded-full bg-line" aria-hidden />

        <div className="mb-3.5 flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <h2 className="text-[21px] font-semibold leading-tight text-ink">
              {isFirst ? "tu primera parada" : `parada ${index + 1}`}
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

          {/* Fecha: calendario de 2 formas (1ª parada) o llegada encadenada */}
          {isFirst ? (
            <StopDatePicker
              modo={modo}
              onModo={(m) => {
                if (m === modo) return;
                if (m === "dias") {
                  if (rangoOk) setNoches(Math.max(1, diffDays(startDate, endDate)));
                } else if (startDate) {
                  setEndDate(addDaysYmd(startDate, Math.max(1, noches)));
                }
                setModo(m);
              }}
              start={startDate}
              setStart={setStartDate}
              end={endDate}
              setEnd={setEndDate}
              noches={noches}
              setNoches={setNoches}
            />
          ) : (
            <>
              <div className="flex items-center gap-2.5 rounded-sm border border-line bg-bg px-[13px] py-3">
                <Icon name="calendario" size={17} className="shrink-0 text-muted" />
                <span className="text-[13.5px] font-semibold text-ink">
                  Llegas el {dmEs(arrival)}
                </span>
                <span className="ml-auto rounded-sm border border-line bg-surface px-[7px] py-0.5 text-[10.5px] font-semibold text-muted">
                  se encadena
                </span>
              </div>
              <div className="flex items-center justify-between gap-2.5">
                <div>
                  <b className="block text-[13.5px] font-semibold text-ink">¿cuántas noches?</b>
                  <span className="text-[11.5px] text-muted">
                    {q.trim() ? `en ${q.trim()}` : "aquí"}
                  </span>
                </div>
                <Stepper
                  value={noches}
                  min={1}
                  onMinus={() => setNoches((n) => Math.max(1, n - 1))}
                  onPlus={() => setNoches((n) => n + 1)}
                />
              </div>
            </>
          )}

          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSave(index, q.trim(), effNoches, isFirst ? startDate : undefined)}
            className="mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-accent text-sm font-semibold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50"
          >
            <Icon name="check" size={17} />
            {editing ? "guardar cambios" : "añadir a mi ruta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Calendario de la 1ª parada con 2 FORMAS (rediseño v3): toggle "inicio y fin"
// (rango: dos toques) vs "inicio + días" (un toque + stepper). Pinta el rango
// (extremos en círculo negro, intermedios en paper2) y deriva las noches. Ambos
// modos producen el mismo {startDate, noches} que ya consume saveParada.
function StopDatePicker({
  modo,
  onModo,
  start,
  setStart,
  end,
  setEnd,
  noches,
  setNoches,
}: {
  modo: "rango" | "dias";
  onModo: (m: "rango" | "dias") => void;
  start: string;
  setStart: (ds: string) => void;
  end: string;
  setEnd: (ds: string) => void;
  noches: number;
  setNoches: React.Dispatch<React.SetStateAction<number>>;
}) {
  const today = todayDate();
  const [view, setView] = useState(() =>
    firstOfMonth(start ? new Date(start + "T00:00:00Z") : today)
  );
  const y = view.getUTCFullYear();
  const m = view.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const firstDow = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const monthLabel = view.toLocaleDateString("es", { month: "long", year: "numeric", timeZone: "UTC" });

  // Fin pintado: en "días" se deriva del stepper (inicio + noches).
  const paintEnd = modo === "dias" ? (start ? addDaysYmd(start, Math.max(1, noches)) : "") : end;
  const hasRange = !!start && !!paintEnd && paintEnd > start;
  const todayY = ymd(today);

  function tapDay(ds: string) {
    if (modo === "dias") {
      setStart(ds);
      return;
    }
    // rango: 1er toque = salida; 2º = regreso (o reinicia si es anterior/igual).
    if (!start || (start && end)) {
      setStart(ds);
      setEnd("");
    } else if (ds <= start) {
      setStart(ds);
    } else {
      setEnd(ds);
    }
  }

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(<span key={`b${i}`} />);
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = ymd(new Date(Date.UTC(y, m, day)));
    const past = ds < todayY;
    const isStart = ds === start;
    const isEnd = hasRange && ds === paintEnd;
    const isEnds = isStart || isEnd;
    const between = hasRange && ds > start && ds < paintEnd;
    const band = between
      ? "bg-accent-soft"
      : hasRange && isStart
        ? "rounded-l-full bg-accent-soft"
        : hasRange && isEnd
          ? "rounded-r-full bg-accent-soft"
          : "";
    cells.push(
      <button
        key={ds}
        type="button"
        disabled={past}
        onClick={() => tapDay(ds)}
        className={`flex aspect-square items-center justify-center disabled:cursor-default ${band}`}
      >
        <span
          className={`tabular flex h-9 w-9 items-center justify-center rounded-full text-[13.5px] ${
            isEnds ? "bg-accent font-semibold text-on-accent" : past ? "text-muted/40" : "text-ink"
          }`}
        >
          {day}
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
        <Icon name="calendario" size={14} />
        ¿cuándo viajas?
      </div>

      {/* Toggle de 2 formas (activo = relleno negro) */}
      <div className="flex overflow-hidden rounded-[7px] border border-line">
        {(
          [
            ["rango", "inicio y fin"],
            ["dias", "inicio + días"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => onModo(k)}
            className={`flex-1 py-2 text-[12.5px] font-semibold transition-colors ${
              modo === k ? "bg-accent text-on-accent" : "bg-surface text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Calendario grande */}
      <div className="rounded-sm border border-line bg-surface p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <b className="text-sm font-semibold lowercase text-ink">{monthLabel}</b>
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

      {/* Modo días: stepper de noches grande */}
      {modo === "dias" && start ? (
        <div className="flex items-center justify-between gap-2.5">
          <b className="text-[13.5px] font-semibold text-ink">¿cuántas noches?</b>
          <Stepper
            value={Math.max(1, noches)}
            min={1}
            onMinus={() => setNoches((n) => Math.max(1, n - 1))}
            onPlus={() => setNoches((n) => n + 1)}
          />
        </div>
      ) : null}

      {/* Resumen (acento serif itálico) o instrucción */}
      {hasRange ? (
        <p className="display text-[15px] italic text-ink">
          {modo === "rango"
            ? `${dmEs(start)} – ${dmEs(paintEnd)} · ${diffDays(start, paintEnd)} noches`
            : `vuelves el ${dmEs(paintEnd)} · ${Math.max(1, noches)} noches`}
        </p>
      ) : modo === "rango" && start ? (
        <p className="text-[12.5px] text-muted">toca el día en que regresas</p>
      ) : (
        <p className="text-[12.5px] text-muted">
          {modo === "rango" ? "toca tu día de salida y el de regreso" : "toca tu día de salida"}
        </p>
      )}
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
        // El último ocupa fila completa SOLO si el total es impar (para no dejar
        // un hueco). Con total par, todos van a 2 columnas.
        const full = i === OCCASIONS.length - 1 && OCCASIONS.length % 2 === 1;
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
              {o.label.toLowerCase()}
            </b>
          </button>
        );
      })}
    </div>
  );
}

// ---- Paso 3: Maleta (multi-maleta: cantidades por tipo + capacidad total) ----
// Modelo aerolínea: puedes combinar varias piezas (mochila + carry-on + N
// documentadas). La capacidad total (techo) es la suma de las capacidades.
function StepMaleta({
  bolsas,
  onChange,
}: {
  bolsas: Bolsas;
  onChange: (b: Bolsas) => void;
}) {
  const setN = (tipo: Luggage, n: number) => {
    const clamped = Math.max(0, Math.min(n, 4));
    const next: Bolsas = { ...bolsas, [tipo]: clamped };
    if (clamped === 0) delete next[tipo];
    onChange(next);
  };
  const total = bolsasCount(bolsas);
  const capacidad = luggageCapacity(bolsas);

  return (
    <div className="flex flex-col gap-2.5">
      {LUGGAGE.map((l) => {
        const n = bolsas[l.value] ?? 0;
        const on = n > 0;
        return (
          <div
            key={l.value}
            className={`flex items-center gap-3.5 rounded-md border bg-surface p-4 transition-colors ${
              on ? ON_CARD : "border-line"
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
                {l.label.toLowerCase()}
              </b>
              <span className="text-xs text-muted">
                {l.hint} · ~{l.maxPiezas} piezas
              </span>
            </span>
            <div className="flex shrink-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => setN(l.value, n - 1)}
                disabled={n === 0}
                aria-label={`Quitar ${l.short}`}
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-line bg-bg text-ink transition-colors hover:border-ink disabled:opacity-30"
              >
                <Icon name="menos" size={16} strokeWidth={2} />
              </button>
              <b className="tabular w-4 text-center text-[15px] font-semibold text-ink" aria-live="polite">
                {n}
              </b>
              <button
                type="button"
                onClick={() => setN(l.value, n + 1)}
                disabled={n >= 4}
                aria-label={`Agregar ${l.short}`}
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-line bg-bg text-ink transition-colors hover:border-ink disabled:opacity-30"
              >
                <Icon name="mas" size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-between rounded-md bg-accent-soft px-4 py-3">
        <span className="text-[13px] font-medium text-ink">
          {total === 0
            ? "elige al menos una pieza de equipaje"
            : `${total} ${total === 1 ? "pieza" : "piezas"} de equipaje`}
        </span>
        {total > 0 ? (
          <span className="tabular text-[13px] font-semibold text-accent">~{capacidad} prendas</span>
        ) : null}
      </div>
      <div className="flex items-start gap-2 text-xs leading-snug text-muted">
        <Icon name="destello" size={15} className="mt-px shrink-0 text-accent" />
        <span>es un techo, no una meta: armo lo mínimo que combina. si cabe menos, mejor.</span>
      </div>
    </div>
  );
}

// ---- Contexto libre: "¿algo especial de este viaje?" (opcional) ----
// Mismo lever que el "¿algo en mente?" de Hoy: una frase de lo que la persona
// va a hacer (un partido, una boda, hiking, "me gusta viajar cómodo") afina la
// cápsula y los looks mejor que cualquier chip rígido.
const CONTEXTO_MAX = 200;
function ContextoField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-6 flex flex-col gap-2.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
        ¿algo especial? · opcional
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, CONTEXTO_MAX))}
        rows={3}
        placeholder="Ej: voy a un partido del Mundial, una boda, un día de hiking, me gusta viajar cómodo…"
        className="w-full resize-none rounded-md border border-line bg-surface p-[13px] text-[14px] leading-snug text-ink transition-colors placeholder:text-muted focus:border-ink focus:outline-none"
      />
      <div className="flex items-start gap-2 text-xs leading-snug text-muted">
        <Icon name="destello" size={15} className="mt-px shrink-0 text-accent" />
        <span>lo uso para afinar qué empacas y cómo combino tus looks.</span>
      </div>
    </div>
  );
}

// ---- Anclas: "¿algo que quieras llevar sí o sí?" (opcional, hasta 4) ----
// El mismo espíritu que el ancla de Hoy: eliges prendas de tu clóset y el motor
// arma la maleta ALREDEDOR de ellas (van seguras, salen como "tienes").
function AnclasSection({
  anclas,
  onOpen,
  onRemove,
}: {
  anclas: ClosetPick[];
  onOpen: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="mt-6 flex flex-col gap-2.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
        Opcional
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-3 rounded-md border border-line bg-surface p-[13px] text-left transition-colors hover:border-ink"
      >
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-sm bg-accent-soft text-ink">
          <Icon name="gancho" size={18} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="text-sm font-semibold text-ink">
            ¿algo que quieras llevar sí o sí?
          </b>
          <span className="text-[12px] text-muted">
            {anclas.length > 0
              ? `${anclas.length} de ${MAX_ANCLAS} elegidas — armo la maleta alrededor`
              : `elige hasta ${MAX_ANCLAS} prendas y armo la maleta alrededor`}
          </span>
        </span>
        <Icon name="chevron" size={16} className="shrink-0 text-muted" />
      </button>

      {anclas.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {anclas.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-sm border border-line bg-surface py-1 pl-1 pr-2"
            >
              <span className="relative block h-9 w-7 overflow-hidden rounded-[3px] bg-bg">
                {a.imagen ? (
                  <Image src={a.imagen} alt="" fill sizes="28px" className="object-cover" />
                ) : (
                  <span className="block h-full w-full" style={{ backgroundColor: a.swatch }} />
                )}
              </span>
              <span className="max-w-[130px] truncate text-[12px] font-medium text-ink">
                {a.nombre}
              </span>
              <button
                type="button"
                onClick={() => onRemove(a.id)}
                aria-label={`Quitar ${a.nombre}`}
                className="-mr-0.5 flex h-5 w-5 items-center justify-center text-muted hover:text-ink"
              >
                <Icon name="equis" size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AnclasSheet({
  closet,
  selected,
  onToggle,
  onClose,
}: {
  closet: ClosetPick[];
  selected: ClosetPick[];
  onToggle: (p: ClosetPick) => void;
  onClose: () => void;
}) {
  const ids = new Set(selected.map((a) => a.id));
  const atCap = selected.length >= MAX_ANCLAS;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center lg:items-center bg-ink/50"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-[430px] flex-col gap-3 overflow-hidden rounded-t-[18px] lg:rounded-[18px] bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"
        style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="h-1 w-9 rounded-full bg-line" aria-hidden />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 flex h-9 w-9 items-center justify-center text-muted hover:text-ink"
          >
            <Icon name="equis" size={20} />
          </button>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">
            Llevar sí o sí
          </span>
          <span className="text-[15px] font-semibold text-ink">
            {selected.length} de {MAX_ANCLAS} — tus queridas van primero
          </span>
        </div>

        <ul className="grid min-h-0 flex-1 grid-cols-4 gap-2 overflow-y-auto pb-1">
          {closet.map((p) => {
            const on = ids.has(p.id);
            const blocked = !on && atCap;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onToggle(p)}
                  disabled={blocked}
                  aria-pressed={on}
                  title={p.nombre}
                  className={`relative block w-full overflow-hidden rounded-md border transition-colors ${
                    on ? "border-accent" : "border-line hover:border-ink"
                  } ${blocked ? "opacity-40" : ""}`}
                >
                  <span className="relative block aspect-[3/4] bg-bg">
                    {p.imagen ? (
                      <Image src={p.imagen} alt={p.nombre} fill sizes="100px" className="object-cover" />
                    ) : (
                      <span
                        className="block h-full w-full"
                        style={{ backgroundColor: p.swatch }}
                      />
                    )}
                  </span>
                  <span
                    className={`absolute right-1 top-1 flex h-[19px] w-[19px] items-center justify-center rounded-full ${
                      on ? "bg-accent text-on-accent" : "border-[1.5px] border-line bg-bg/85"
                    }`}
                  >
                    {on ? <Icon name="check" size={12} strokeWidth={2.4} /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={onClose}
          className="flex min-h-12 w-full items-center justify-center rounded-sm bg-accent text-sm font-semibold text-on-accent transition-colors hover:bg-accent-deep"
        >
          listo
        </button>
      </div>
    </div>
  );
}
