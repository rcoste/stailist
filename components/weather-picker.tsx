"use client";

import { useState } from "react";
import { Spinner } from "@/components/spinner";
import { Icon, type IconName } from "@/components/icon";

// Compositor de "crear outfit" como WIZARD de 3 pasos (rebrand v3):
// 1) ocasión (grid 2×2 + campo abierto) · 2) día/noche · 3) clima (lista de
// bandas + ubicación). Vive dentro del estado `ask` de hoy-client y, al terminar,
// llama onPick(input) con el MISMO contrato LookInput — sin tocar backend.

export type LookInput = {
  objective: string;
  plan?: string;
  momento: "dia" | "noche";
} & ({ lat: number; lon: number } | { weather: { temp_c: number; condition: string } });

// 4 ocasiones del wizard (sin "viaje": ya hay un Modo viaje propio).
const OCASIONES: { key: string; label: string; help: string; icon: IconName }[] = [
  { key: "diario", label: "el día a día", help: "lo de siempre, resuelto", icon: "sol" },
  { key: "oficina", label: "oficina", help: "verte pro sin pensarlo", icon: "maletin" },
  { key: "evento", label: "un evento", help: "algo que importa", icon: "destello" },
  { key: "refrescar", label: "refrescar", help: "distinto a ayer", icon: "repetir" },
];
const OCASION_KEYS = new Set(OCASIONES.map((o) => o.key));

// 5 bandas de temperatura (mismas de modo Viaje — set canónico, no inventar).
const BUCKETS = [
  { label: "Helado", ref: "para abrigo grueso", temp_c: 5 },
  { label: "Frío", ref: "suéter o chamarra", temp_c: 12 },
  { label: "Templado", ref: "manga larga ligera", temp_c: 19 },
  { label: "Cálido", ref: "playera, a gusto", temp_c: 25 },
  { label: "Caluroso", ref: "lo más fresco", temp_c: 33 },
];

function getPosition(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    const timer = setTimeout(() => resolve(null), 5000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { timeout: 4500, maximumAge: 600000 }
    );
  });
}

export function LookRequest({
  defaultObjective,
  onPick,
  onExit,
  skipObjective,
}: {
  title?: string;
  defaultObjective: string | null;
  onPick: (input: LookInput) => void;
  onExit?: () => void;
  // Wow (primer outfit): la ocasión ya se eligió en el paso de onboarding →
  // arranca en "momento" y muestra 2 pasos en vez de 3 (no re-pregunta ocasión).
  skipObjective?: boolean;
}) {
  const hasDefaultObj = !!(
    defaultObjective && OCASION_KEYS.has(defaultObjective)
  );
  const skip = !!skipObjective && hasDefaultObj;
  const firstStep: 1 | 2 = skip ? 2 : 1;
  const totalSteps = skip ? 2 : 3;
  const [step, setStep] = useState<1 | 2 | 3>(firstStep);
  const [objective, setObjective] = useState<string | null>(
    hasDefaultObj ? defaultObjective : null
  );
  const [openText, setOpenText] = useState("");
  const [momento, setMomento] = useState<"dia" | "noche">("dia");
  const [climaIdx, setClimaIdx] = useState(2); // Templado por defecto
  const [rain, setRain] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locFailed, setLocFailed] = useState(false);

  // Campo abierto y tarjetas son mutuamente excluyentes (el "o" lo deja claro).
  const hasOpen = openText.trim().length > 0;
  const objectivePart: { objective: string; plan?: string } = hasOpen
    ? { objective: "diario", plan: openText.trim() }
    : { objective: objective ?? "diario" };

  const step1Ready = !!objective || hasOpen;

  function next() {
    setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  }
  function back() {
    if (step === firstStep) onExit?.();
    else setStep((s) => (s - 1) as 1 | 2 | 3);
  }

  async function useLocation() {
    setLocating(true);
    setLocFailed(false);
    const coords = await getPosition();
    setLocating(false);
    if (coords) onPick({ ...objectivePart, momento, ...coords });
    else setLocFailed(true);
  }

  function armar() {
    const b = BUCKETS[climaIdx];
    onPick({
      ...objectivePart,
      momento,
      weather: { temp_c: b.temp_c, condition: rain ? "lluvia" : "despejado" },
    });
  }

  // Tarjetas y campo abierto son mutuamente excluyentes: elegir una ocasión
  // limpia el texto; escribir algo des-selecciona las tarjetas.
  function pickObjective(key: string) {
    setObjective((o) => (o === key ? null : key));
    setOpenText("");
  }
  function changeOpenText(v: string) {
    setOpenText(v);
    if (v.trim()) setObjective(null);
  }

  const displayStep = skip ? step - 1 : step;
  const meta = `PASO ${displayStep} DE ${totalSteps}`;
  // Titular con una palabra en serif itálica de acento (Instrument Serif).
  const question =
    step === 1 ? (
      <>
        ¿a dónde <em className={EM}>vas</em> hoy?
      </>
    ) : step === 2 ? (
      <>
        ¿de día o <em className={EM}>de noche</em>?
      </>
    ) : (
      <>
        ¿cómo está <em className={EM}>el clima</em>?
      </>
    );
  const showBack = step !== firstStep || !!onExit;

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <div className="mx-auto flex h-full max-w-[430px] flex-col">
        {/* Header del paso: cuadro atrás + barra de progreso de 3 segmentos */}
        <div className="px-[18px] pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-3.5">
            {showBack ? (
              <button
                type="button"
                onClick={back}
                aria-label={step === firstStep ? "Salir" : "Atrás"}
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center border border-line text-ink transition-colors hover:border-ink"
              >
                <Icon
                  name={step === firstStep ? "equis" : "chevron"}
                  size={16}
                  rotate={step === firstStep ? 0 : 180}
                />
              </button>
            ) : (
              <span className="h-[34px] w-[34px]" />
            )}
            <div className="flex flex-1 gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <span
                  key={i}
                  className={`h-[3px] flex-1 rounded-full transition-colors duration-200 ${
                    i <= displayStep - 1 ? "bg-ink" : "bg-line"
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="mt-[26px] text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
            {meta}
          </p>
          <h1 className="mt-2 text-[30px] font-bold leading-[1.04] tracking-[-0.025em] text-ink">
            {question}
          </h1>
        </div>

        {/* Cuerpo scrollable (animado por paso) */}
        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-4 pt-[26px]">
          <div key={step} style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}>
            {step === 1 ? (
              <StepOcasion
                objective={objective}
                openText={openText}
                onPick={pickObjective}
                onOpenText={changeOpenText}
              />
            ) : step === 2 ? (
              <StepMomento momento={momento} onPick={setMomento} />
            ) : (
              <StepClima
                idx={climaIdx}
                rain={rain}
                locating={locating}
                locFailed={locFailed}
                onIdx={setClimaIdx}
                onRain={setRain}
                onLocate={useLocation}
              />
            )}
          </div>
        </div>

        {/* Footer fijo: un solo CTA full-width (el atrás vive en el header) */}
        <div className="flex flex-none border-t border-line bg-surface px-[18px] pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={step === 3 ? armar : next}
            disabled={(step === 1 && !step1Ready) || (step === 3 && locating)}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50"
          >
            {step === 3 ? (
              <>
                <Icon name="destello" size={18} /> armar mi look
              </>
            ) : (
              <>
                siguiente <Icon name="flecha" size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Acento serif itálico para los titulares del wizard (Instrument Serif).
const EM = "font-display font-normal italic tracking-normal";
// Selección v3 monocroma: borde tinta (inset, sin reflow) — el ícono se rellena
// de tinta. Sin fondo de color (el v2 usaba tinte rosado/soft).
const ON = "border-ink shadow-[inset_0_0_0_1px_var(--c-ink)]";
const ICON_ON = "bg-accent border-accent text-on-accent";

function StepOcasion({
  objective,
  openText,
  onPick,
  onOpenText,
}: {
  objective: string | null;
  openText: string;
  onPick: (key: string) => void;
  onOpenText: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-2.5">
        {OCASIONES.map((o) => {
          const on = objective === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onPick(o.key)}
              aria-pressed={on}
              className={`flex min-h-[120px] flex-col gap-2.5 border bg-surface p-4 text-left transition-colors ${
                on ? ON : "border-line hover:border-ink"
              }`}
            >
              <span
                className={`flex h-[34px] w-[34px] items-center justify-center border transition-colors ${
                  on ? ICON_ON : "border-line bg-bg text-ink"
                }`}
              >
                <Icon name={o.icon} size={18} />
              </span>
              <b className="mt-auto text-[16px] font-semibold leading-tight text-ink">
                {o.label}
              </b>
              <span className="font-display text-[15px] leading-tight text-muted">
                {o.help}
              </span>
            </button>
          );
        })}
      </div>

      {/* Campo abierto (alternativa) */}
      <div className="flex flex-col">
        <div className="my-0.5 mb-2 flex items-center gap-2.5">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            o algo más específico
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <label
          className={`flex items-center gap-2.5 border bg-surface px-3.5 py-3.5 transition-colors focus-within:border-ink ${
            openText ? "border-ink" : "border-line"
          }`}
        >
          <Icon
            name="lapiz"
            size={18}
            className={`shrink-0 ${openText ? "text-ink" : "text-muted"}`}
          />
          <input
            value={openText}
            onChange={(e) => onOpenText(e.target.value)}
            maxLength={200}
            placeholder={`escríbelo tú — "cena con mis amigos"`}
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink caret-accent outline-none placeholder:text-muted"
          />
        </label>
      </div>
    </div>
  );
}

function StepMomento({
  momento,
  onPick,
}: {
  momento: "dia" | "noche";
  onPick: (m: "dia" | "noche") => void;
}) {
  const cards: { key: "dia" | "noche"; icon: IconName; title: string; sub: string }[] = [
    { key: "dia", icon: "sol", title: "de día", sub: "junta, lunch, oficina" },
    { key: "noche", icon: "luna", title: "de noche", sub: "cena, drinks, salida" },
  ];
  return (
    <div className="flex flex-col gap-3">
      {cards.map((c) => {
        const on = momento === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onPick(c.key)}
            aria-pressed={on}
            className={`flex items-center gap-4 border bg-surface px-5 py-[22px] text-left transition-colors ${
              on ? ON : "border-line hover:border-ink"
            }`}
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center border transition-colors ${
                on ? ICON_ON : "border-line bg-bg text-ink"
              }`}
            >
              <Icon name={c.icon} size={22} />
            </span>
            <span className="flex flex-col">
              <b className="text-[20px] font-semibold text-ink">{c.title}</b>
              <span className="font-display text-[16px] text-muted">{c.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StepClima({
  idx,
  rain,
  locating,
  locFailed,
  onIdx,
  onRain,
  onLocate,
}: {
  idx: number;
  rain: boolean;
  locating: boolean;
  locFailed: boolean;
  onIdx: (i: number) => void;
  onRain: (r: boolean) => void;
  onLocate: () => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Píldora de ubicación: si la usa, se leen temp Y lluvia automáticamente. */}
      <button
        type="button"
        onClick={onLocate}
        disabled={locating}
        className="flex items-center gap-3 border border-line bg-surface p-3.5 text-left transition-colors hover:border-ink disabled:opacity-60"
      >
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          {locating ? <Spinner className="h-4 w-4" /> : <Icon name="ubicacion" size={17} />}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-semibold text-ink">
            {locating ? "leyendo el clima…" : "usar mi ubicación"}
          </span>
          <span className="font-display text-[15px] text-muted">
            {locFailed ? "no pude leerla — dime tú abajo" : "leo temp y lluvia por ti"}
          </span>
        </span>
        <Icon name="chevron" size={17} className="ml-auto shrink-0 text-muted" />
      </button>

      {/* Divisor */}
      <div className="my-[18px] flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
          o dime tú
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {/* Lista de 5 bandas (bordes colapsados con -mt-px) */}
      <div className="flex flex-col">
        {BUCKETS.map((b, i) => {
          const on = i === idx;
          return (
            <button
              key={b.label}
              type="button"
              onClick={() => onIdx(i)}
              aria-pressed={on}
              className={`-mt-px flex items-center gap-3.5 border p-3.5 text-left transition-colors ${
                on
                  ? "relative z-[2] border-ink shadow-[inset_0_0_0_1px_var(--c-ink)]"
                  : "border-line hover:border-ink"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full border transition-colors ${
                  on ? "border-ink bg-ink" : "border-muted"
                }`}
              />
              <span className="w-[84px] shrink-0 text-[16px] font-semibold text-ink">
                {b.label}
              </span>
              <span className="font-display text-[16px] text-muted">{b.ref}</span>
              <span className="tabular ml-auto text-[14px] font-bold text-ink">
                {b.temp_c}°
              </span>
            </button>
          );
        })}
      </div>

      {/* Fila de lluvia (solo el camino manual) */}
      <div className="mt-[18px] flex items-center gap-3">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <Icon name="lluvia" size={17} className="text-muted" /> ¿va a llover?
        </span>
        <div className="ml-auto inline-flex overflow-hidden rounded-sm border border-line">
          <button
            type="button"
            onClick={() => onRain(false)}
            aria-pressed={!rain}
            className={`min-h-[38px] px-5 text-[14px] font-semibold transition-colors ${
              !rain ? "bg-accent text-on-accent" : "bg-surface text-ink"
            }`}
          >
            no
          </button>
          <button
            type="button"
            onClick={() => onRain(true)}
            aria-pressed={rain}
            className={`min-h-[38px] border-l border-line px-5 text-[14px] font-semibold transition-colors ${
              rain ? "bg-accent text-on-accent" : "bg-surface text-ink"
            }`}
          >
            sí
          </button>
        </div>
      </div>
    </div>
  );
}
