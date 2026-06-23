"use client";

import { useState } from "react";
import { Spinner } from "@/components/spinner";
import { Icon, type IconName } from "@/components/icon";

// Compositor de "crear outfit" como WIZARD de 3 pasos (handoff home-crear-outfit):
// 1) ocasión (grid 2×2 + campo abierto) · 2) día/noche · 3) clima (slider).
// Vive dentro del estado `ask` de hoy-client y, al terminar, llama onPick(input)
// con el MISMO contrato LookInput — sin tocar backend ni la máquina de estados.

export type LookInput = {
  objective: string;
  plan?: string;
  momento: "dia" | "noche";
} & ({ lat: number; lon: number } | { weather: { temp_c: number; condition: string } });

// 4 ocasiones del wizard (sin "viaje": ya hay un Modo viaje propio).
const OCASIONES: { key: string; label: string; help: string; icon: IconName }[] = [
  { key: "diario", label: "El día a día", help: "lo de siempre, bien resuelto", icon: "sol" },
  { key: "oficina", label: "Oficina", help: "verte pro sin pensarlo", icon: "maletin" },
  { key: "evento", label: "Un evento", help: "algo que importa", icon: "destello" },
  { key: "refrescar", label: "Solo refrescar", help: "algo distinto a lo de ayer", icon: "repetir" },
];
const OCASION_KEYS = new Set(OCASIONES.map((o) => o.key));

// 5 paradas del slider de temperatura (idéntico a los BUCKETS de siempre).
const BUCKETS = [
  { label: "Helado", ref: "para abrigo grueso", temp_c: 5 },
  { label: "Frío", ref: "suéter o chamarra", temp_c: 12 },
  { label: "Templado", ref: "manga larga ligera", temp_c: 19 },
  { label: "Cálido", ref: "playera, a gusto", temp_c: 25 },
  { label: "Caluroso", ref: "lo más fresco posible", temp_c: 33 },
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
  const meta =
    step === 3
      ? `Paso ${totalSteps} de ${totalSteps} · último`
      : `Paso ${displayStep} de ${totalSteps}`;
  const question =
    step === 1 ? "¿a dónde vas hoy?" : step === 2 ? "¿de día o de noche?" : "¿qué clima hace?";

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <div className="mx-auto flex h-full max-w-[430px] flex-col">
        {/* Header del paso */}
        <div className="px-[18px] pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between">
            {step !== firstStep || onExit ? (
              <button
                type="button"
                onClick={back}
                className="flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
              >
                <Icon name="chevron" size={15} rotate={180} />
                {step === firstStep ? "Hoy" : "Atrás"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => {
                const idx = displayStep - 1;
                const active = i === idx;
                const done = i < idx;
                return (
                  <span
                    key={i}
                    className={`h-[7px] rounded-full transition-all duration-200 ${
                      active ? "w-5 bg-accent" : done ? "w-[7px] bg-accent" : "w-[7px] bg-line"
                    }`}
                  />
                );
              })}
            </div>
          </div>
          <p className="mt-[18px] text-[11.5px] font-medium text-muted">{meta}</p>
          <h1 className="mt-[7px] display text-[27px] font-semibold leading-[1.12] tracking-[-0.01em] text-ink">
            {question}
          </h1>
          {step === 2 ? (
            <p className="mt-2.5 text-[13px] leading-relaxed text-muted">
              Cambia el tono del look — más relajado de día, más arreglado de noche.
            </p>
          ) : null}
        </div>

        {/* Cuerpo scrollable (animado por paso) */}
        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-4 pt-[18px]">
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

        {/* Footer fijo con CTA(s) */}
        <div className="flex flex-none gap-2.5 border-t border-line bg-surface px-[18px] pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {step === 3 ? (
            <button
              type="button"
              onClick={armar}
              disabled={locating}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-accent text-sm font-semibold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50"
            >
              <Icon name="destello" size={18} />
              Armar mi look
            </button>
          ) : step === firstStep ? (
            <button
              type="button"
              onClick={next}
              disabled={step === 1 && !step1Ready}
              className="flex min-h-12 w-full items-center justify-center rounded-sm bg-accent text-sm font-semibold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50"
            >
              Siguiente
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={back}
                className="min-h-12 flex-1 rounded-sm border border-line bg-surface text-sm font-semibold text-ink transition-colors hover:border-ink"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={next}
                className="min-h-12 flex-[2] rounded-sm bg-accent text-sm font-semibold text-on-accent transition-colors hover:bg-accent-deep"
              >
                Siguiente
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Patrón de "elegido" del handoff: borde + inset acento + fondo soft + caja de
// icono en acento + texto en acento. Sin palomita ni radio (selección única).
const ON = "border-accent bg-accent-soft shadow-[inset_0_0_0_1px_var(--c-accent)]";
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
              className={`flex min-h-[120px] flex-col gap-2.5 rounded-md border bg-surface p-4 text-left transition-colors ${
                on ? ON : "border-line hover:border-ink"
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-sm border transition-colors ${
                  on ? ICON_ON : "border-line bg-bg text-ink"
                }`}
              >
                <Icon name={o.icon} size={20} />
              </span>
              <b
                className={`mt-auto text-[14.5px] font-semibold leading-tight ${
                  on ? "text-accent" : "text-ink"
                }`}
              >
                {o.label}
              </b>
              <span className="text-[11.5px] leading-snug text-muted">{o.help}</span>
            </button>
          );
        })}
      </div>

      {/* Campo abierto (alternativa) */}
      <div className="flex flex-col">
        <div className="my-0.5 mb-2 flex items-center gap-2.5">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
            o algo más específico
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <label
          className={`flex items-center gap-2.5 rounded-md border bg-surface px-3.5 py-3.5 transition-colors focus-within:border-accent ${
            openText ? "border-accent" : "border-line"
          }`}
        >
          <Icon
            name="lapiz"
            size={18}
            className={`shrink-0 ${openText ? "text-accent" : "text-muted"}`}
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
    { key: "dia", icon: "sol", title: "De día", sub: "luz natural, todo más relajado" },
    { key: "noche", icon: "luna", title: "De noche", sub: "para subirle un punto al arreglo" },
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
            className={`flex items-center gap-[15px] rounded-md border bg-surface px-[18px] py-5 text-left transition-colors ${
              on ? ON : "border-line hover:border-ink"
            }`}
          >
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                on ? ICON_ON : "border-line bg-bg text-ink"
              }`}
            >
              <Icon name={c.icon} size={22} />
            </span>
            <span className="flex flex-col">
              <b className={`text-[16.5px] font-semibold ${on ? "text-accent" : "text-ink"}`}>
                {c.title}
              </b>
              <span className="text-[12.5px] text-muted">{c.sub}</span>
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
    <div className="flex flex-col gap-[18px]">
      <button
        type="button"
        onClick={onLocate}
        disabled={locating}
        className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-sm border border-line bg-surface text-[13.5px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-60"
      >
        {locating ? (
          <>
            <Spinner className="h-4 w-4" /> Leyendo el clima…
          </>
        ) : (
          <>
            <Icon name="ubicacion" size={18} /> Usar mi ubicación
          </>
        )}
      </button>

      <div className="flex items-center gap-2.5">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11.5px] text-muted">
          {locFailed ? "no pude leerla — dime tú" : "o dímelo tú"}
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <TempSlider idx={idx} onIdx={onIdx} />

      <div className="flex items-center justify-between gap-2.5">
        <span className="text-[13px] font-medium text-ink">¿Va a llover?</span>
        <div className="inline-flex overflow-hidden rounded-sm border border-line">
          <button
            type="button"
            onClick={() => onRain(false)}
            className={`min-h-[38px] px-[22px] text-[13px] font-semibold transition-colors ${
              !rain ? "bg-accent-soft text-accent" : "bg-surface text-ink"
            }`}
          >
            No
          </button>
          <button
            type="button"
            onClick={() => onRain(true)}
            className={`min-h-[38px] border-l border-line px-[22px] text-[13px] font-semibold transition-colors ${
              rain ? "bg-accent-soft text-accent" : "bg-surface text-ink"
            }`}
          >
            Sí
          </button>
        </div>
      </div>
    </div>
  );
}

// Slider de temperatura: copo · track con thumb · sol. 5 paradas con snap. Un
// <input range> transparente encima maneja arrastre, tap y teclado (accesible);
// los visuales (fill, thumb, ticks) siguen el valor.
function TempSlider({ idx, onIdx }: { idx: number; onIdx: (i: number) => void }) {
  const b = BUCKETS[idx];
  const pct = (idx / (BUCKETS.length - 1)) * 100;
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3">
        <Icon name="copo" size={18} className="shrink-0 text-muted" />
        <div className="relative flex-1 py-2">
          <div className="relative h-[7px] rounded-full bg-line">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
            <span
              className="absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[2.5px] border-accent bg-surface shadow-[0_2px_6px_rgb(26_23_24/0.16)] transition-[left] duration-200"
              style={{ left: `${pct}%` }}
            >
              <span className="h-[9px] w-[9px] rounded-full bg-accent" />
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={BUCKETS.length - 1}
            step={1}
            value={idx}
            onChange={(e) => onIdx(Number(e.target.value))}
            aria-label="Temperatura"
            aria-valuetext={`${b.label} — ${b.ref}`}
            className="absolute inset-x-0 top-0 h-full w-full cursor-pointer opacity-0"
          />
          <div className="mt-[11px] flex justify-between">
            {BUCKETS.map((bk, i) => (
              <span
                key={bk.label}
                className={`h-[7px] w-[2px] rounded-[1px] ${i === idx ? "bg-accent" : "bg-line"}`}
              />
            ))}
          </div>
        </div>
        <Icon name="sol" size={18} className="shrink-0 text-muted" />
      </div>
      <div className="mt-3.5 text-center" aria-live="polite">
        <b className="text-[18px] font-semibold text-ink">{b.label}</b>
        <span className="mt-0.5 block text-[13px] text-muted">{b.ref}</span>
      </div>
      <div className="mt-2.5 flex justify-between px-0.5 text-[11px] text-muted">
        <span>más frío</span>
        <span>más calor</span>
      </div>
    </div>
  );
}
