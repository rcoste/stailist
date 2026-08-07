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
  seedItemId?: string | null; // ancla opcional: prenda fijada para hoy
  formality?: string | null; // solo en "evento": casual | semiformal | formal | gala
  /** Va a llevar paraguas. Solo viaja cuando dijo que llueve. */
  paraguas?: boolean;
} & ({ lat: number; lon: number } | { weather: { temp_c: number; condition: string } });

// Prenda del clóset para el picker de ancla (foto resuelta en el server).
export type ClosetPick = {
  id: string;
  nombre: string;
  swatch: string;
  imagen: string | null;
  category: string; // top | vestido | bottom | abrigo | calzado | accesorio | otros
};

// Categorías del picker (mismo orden/labels que el clóset del onboarding).
const CAT_ORDER = ["top", "vestido", "bottom", "abrigo", "calzado", "accesorio", "otros"];
const CAT_LABELS: Record<string, string> = {
  top: "Arriba",
  vestido: "Vestidos",
  bottom: "Abajo",
  abrigo: "Abrigos",
  calzado: "Zapatos",
  accesorio: "Accesorios",
  otros: "Otros",
};
// Quita acentos + minúsculas para buscar sin que estorben las tildes.
const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// 4 ocasiones del wizard (sin "viaje": ya hay un Modo viaje propio).
const OCASIONES: { key: string; label: string; help: string; icon: IconName }[] = [
  { key: "diario", label: "el día a día", help: "lo de siempre, resuelto", icon: "sol" },
  { key: "oficina", label: "oficina", help: "verte pro sin pensarlo", icon: "maletin" },
  { key: "evento", label: "un evento", help: "algo que importa", icon: "destello" },
  { key: "refrescar", label: "refrescar", help: "distinto a ayer", icon: "repetir" },
];
const OCASION_KEYS = new Set(OCASIONES.map((o) => o.key));

// "Un evento" es ambiguo (de un coctel casual a una boda de etiqueta) y el motor
// adivinaba mal. Al elegir evento pedimos el nivel de formalidad para acertar.
const FORMALIDAD: { key: string; label: string }[] = [
  { key: "casual", label: "casual" },
  { key: "semiformal", label: "semiformal" },
  { key: "formal", label: "formal" },
  { key: "gala", label: "de gala" },
];

// 5 bandas de temperatura (mismas de modo Viaje — set canónico, no inventar).
const BUCKETS = [
  { label: "Helado", ref: "para abrigo grueso", temp_c: 5 },
  { label: "Frío", ref: "suéter o chamarra", temp_c: 12 },
  { label: "Templado", ref: "manga larga ligera", temp_c: 19 },
  { label: "Cálido", ref: "playera, a gusto", temp_c: 25 },
  { label: "Caluroso", ref: "lo más fresco", temp_c: 33 },
];

// Etiquetas legibles del plan, reusadas por el "generando" (chips + frase).
export function ocasionLabel(key: string): string {
  return OCASIONES.find((o) => o.key === key)?.label ?? key;
}
export function bucketLabel(temp_c: number): string {
  let best = BUCKETS[0];
  for (const b of BUCKETS) {
    if (Math.abs(b.temp_c - temp_c) < Math.abs(best.temp_c - temp_c)) best = b;
  }
  return best.label;
}

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
  closet = [],
  defaultSeedItemId = null,
}: {
  title?: string;
  defaultObjective: string | null;
  onPick: (input: LookInput) => void;
  onExit?: () => void;
  // Ancla pre-seleccionada: la usa la card "aún no estrenas X" del home, que
  // abre el wizard con esa prenda ya puesta como ancla.
  defaultSeedItemId?: string | null;
  // Wow (primer outfit): la ocasión ya se eligió en el paso de onboarding →
  // arranca en "momento" y muestra 2 pasos en vez de 3 (no re-pregunta ocasión).
  skipObjective?: boolean;
  // Clóset para el picker de ancla (paso clima). Vacío = no se muestra el picker.
  closet?: ClosetPick[];
}) {
  // "viaje" (la opción "Aeropuerto" del onboarding) NO es una ocasión del wizard; se
  // trata como "diario" (look cómodo del día) para NO re-preguntar la ocasión al armar
  // el primer look — si no, el skip fallaba y volvía a pedir la ocasión ya elegida.
  const normObjective = defaultObjective === "viaje" ? "diario" : defaultObjective;
  const hasDefaultObj = !!(normObjective && OCASION_KEYS.has(normObjective));
  const skip = !!skipObjective && hasDefaultObj;
  const firstStep: 1 | 2 = skip ? 2 : 1;
  const totalSteps = skip ? 2 : 3;
  const [step, setStep] = useState<1 | 2 | 3>(firstStep);
  const [objective, setObjective] = useState<string | null>(
    hasDefaultObj ? normObjective : null
  );
  const [openText, setOpenText] = useState("");
  const [momento, setMomento] = useState<"dia" | "noche">("dia");
  // SIN clima por defecto, y es importante que no lo haya.
  //
  // Venía en "Templado" preseleccionado, con su borde de tinta y su bolita
  // llena. Eso hacía dos daños a la vez: la lista de abajo se leía como "ya
  // está contestado" —así que la píldora de ubicación, que es el camino
  // práctico y el único que lee la lluvia, se volvía invisible— y quien pasaba
  // de largo mandaba 19° al motor sin haberlo elegido. Lo segundo no es
  // cosmético: "rompe el clima" fue la etiqueta de defecto más marcada del
  // veredicto (5 de 6). Un clima que nadie eligió es peor que preguntar.
  const [climaIdx, setClimaIdx] = useState<number | null>(null);
  const [rain, setRain] = useState(false);
  // El paraguas cambia SOLO lo de arriba: tapa el torso, no los pies. Sin él,
  // la capa exterior tiene que repeler agua; con él se elige por estilo. Sin
  // esta pregunta, cada día de lluvia colapsaría a la misma chamarra
  // impermeable toda la temporada. Default en `false` a propósito: no
  // contestar debe caer en el lado seguro.
  const [paraguas, setParaguas] = useState(false);
  const [seedItemId, setSeedItemId] = useState<string | null>(defaultSeedItemId); // ancla opcional
  const [sheetOpen, setSheetOpen] = useState(false); // hoja del picker de prenda
  const [formality, setFormality] = useState<string | null>(null); // solo "evento"
  const [locating, setLocating] = useState(false);
  const [locFailed, setLocFailed] = useState(false);

  // Campo abierto y tarjetas son mutuamente excluyentes (el "o" lo deja claro).
  const hasOpen = openText.trim().length > 0;
  const objectivePart: { objective: string; plan?: string } = hasOpen
    ? { objective: "diario", plan: openText.trim() }
    : { objective: objective ?? "diario" };

  // "Evento" exige elegir formalidad para avanzar (es justo el dato que faltaba).
  const step1Ready = hasOpen || (objective === "evento" ? !!formality : !!objective);
  // La formalidad solo viaja cuando la ocasión final es "evento".
  const formalityOut =
    objectivePart.objective === "evento" && !hasOpen ? formality : null;

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
    if (coords)
      onPick({ ...objectivePart, momento, seedItemId, formality: formalityOut, ...coords });
    else setLocFailed(true);
  }

  function armar() {
    if (climaIdx === null) return;
    const b = BUCKETS[climaIdx];
    onPick({
      ...objectivePart,
      momento,
      seedItemId,
      formality: formalityOut,
      weather: { temp_c: b.temp_c, condition: rain ? "lluvia" : "despejado" },
      ...(rain ? { paraguas } : {}),
    });
  }

  // Tarjetas y campo abierto son mutuamente excluyentes: elegir una ocasión
  // limpia el texto; escribir algo des-selecciona las tarjetas.
  function pickObjective(key: string) {
    setObjective((o) => (o === key ? null : key));
    setOpenText("");
    if (key !== "evento") setFormality(null); // formalidad solo aplica a evento
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
              <div className="flex flex-col gap-5">
                <StepOcasion
                  objective={objective}
                  openText={openText}
                  formality={formality}
                  onPick={pickObjective}
                  onOpenText={changeOpenText}
                  onFormality={setFormality}
                />
                {closet.length > 0 ? (
                  <AnchorTrigger
                    selected={closet.find((c) => c.id === seedItemId) ?? null}
                    onOpen={() => setSheetOpen(true)}
                    onClear={() => setSeedItemId(null)}
                  />
                ) : null}
              </div>
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
                paraguas={paraguas}
                onParaguas={setParaguas}
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
            disabled={
              (step === 1 && !step1Ready) ||
              (step === 3 && (locating || climaIdx === null))
            }
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

      {sheetOpen ? (
        <AnchorSheet
          closet={closet}
          selected={seedItemId}
          onSelect={(id) => {
            setSeedItemId(id);
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
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
  formality,
  onPick,
  onOpenText,
  onFormality,
}: {
  objective: string | null;
  openText: string;
  formality: string | null;
  onPick: (key: string) => void;
  onOpenText: (v: string) => void;
  onFormality: (f: string) => void;
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
              <span className="text-[15px] leading-tight text-muted">
                {o.help}
              </span>
            </button>
          );
        })}
      </div>

      {/* Formalidad: solo al elegir "evento" (lo ambiguo). Hay que elegir una
          para poder avanzar — es el dato que faltaba para acertar la boda. */}
      {objective === "evento" ? (
        <div
          className="flex flex-col gap-2.5"
          style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
        >
          <span className="text-[13px] font-semibold text-ink">
            ¿qué tan formal?
          </span>
          <div className="flex flex-wrap gap-2">
            {FORMALIDAD.map((f) => {
              const on = formality === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => onFormality(f.key)}
                  aria-pressed={on}
                  className={`rounded-sm border px-3.5 py-2 text-[14px] font-semibold transition-colors ${
                    on
                      ? "border-accent bg-accent text-on-accent"
                      : "border-line bg-surface text-ink hover:border-ink"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

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
              <span className="text-[16px] text-muted">{c.sub}</span>
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
  paraguas,
  onParaguas,
  onLocate,
}: {
  /** null = nadie ha elegido todavía. Ver el comentario de `climaIdx`. */
  idx: number | null;
  rain: boolean;
  locating: boolean;
  locFailed: boolean;
  onIdx: (i: number) => void;
  onRain: (r: boolean) => void;
  paraguas: boolean;
  onParaguas: (p: boolean) => void;
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
          <span className="text-[15px] text-muted">
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
              <span className="text-[16px] text-muted">{b.ref}</span>
              <span className="tabular ml-auto text-[14px] font-bold text-ink">
                {b.temp_c}°
              </span>
            </button>
          );
        })}
      </div>

      {/* Fila de lluvia (solo el camino manual) */}
      <div className="mt-[18px] mb-1 flex items-center gap-3">
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

      {/* El paraguas, SOLO si dijo que llueve. Cero fricción para quien no le
          llueve, y para quien sí es la pregunta que decide el look: el paraguas
          tapa el torso pero no los pies, así que abre la capa de arriba y deja
          el calzado firme. Sin ella, todos los días de lluvia salen con la
          misma chamarra impermeable. */}
      {rain ? (
        <div
          className="mt-3 flex items-center gap-3"
          style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
        >
          <span className="flex flex-col">
            <span className="text-[14px] font-semibold text-ink">
              ¿llevas paraguas?
            </span>
            <span className="text-[13px] text-muted">
              si sí, arriba te suelto la mano
            </span>
          </span>
          <div className="ml-auto inline-flex overflow-hidden rounded-sm border border-line">
            <button
              type="button"
              onClick={() => onParaguas(false)}
              aria-pressed={!paraguas}
              className={`min-h-[38px] px-5 text-[14px] font-semibold transition-colors ${
                !paraguas ? "bg-accent text-on-accent" : "bg-surface text-ink"
              }`}
            >
              no
            </button>
            <button
              type="button"
              onClick={() => onParaguas(true)}
              aria-pressed={paraguas}
              className={`min-h-[38px] border-l border-line px-5 text-[14px] font-semibold transition-colors ${
                paraguas ? "bg-accent text-on-accent" : "bg-surface text-ink"
              }`}
            >
              sí
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Disparador del ancla (paso 1): fila opcional que muestra la prenda elegida o
// invita a abrir la hoja. Vive con la ocasión (intención), no con el clima.
function AnchorTrigger({
  selected,
  onOpen,
  onClear,
}: {
  selected: ClosetPick | null;
  onOpen: () => void;
  onClear: () => void;
}) {
  return (
    <div className="border-t border-line pt-4">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
        opcional
      </p>
      {selected ? (
        <div className="flex items-center gap-3 border border-ink bg-surface p-2.5">
          <span className="flex h-[44px] w-[36px] shrink-0 items-center justify-center overflow-hidden rounded-sm border border-line bg-tile">
            {selected.imagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.imagen}
                alt={selected.nombre}
                className="h-full w-full object-cover"
              />
            ) : (
              <span
                className="block h-full w-full"
                style={{ backgroundColor: selected.swatch }}
              />
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              vas a usar
            </span>
            <span className="truncate text-[15px] font-semibold text-ink">
              {selected.nombre}
            </span>
          </span>
          <button
            type="button"
            onClick={onOpen}
            className="ml-auto shrink-0 text-[13px] font-semibold text-ink underline underline-offset-2"
          >
            cambiar
          </button>
          <button
            type="button"
            onClick={onClear}
            aria-label="Quitar prenda"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center border border-line text-muted transition-colors hover:border-ink hover:text-ink"
          >
            <Icon name="equis" size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-center gap-3 border border-line bg-surface p-3.5 text-left transition-colors hover:border-ink"
        >
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center border border-line bg-bg text-ink">
            <Icon name="gancho" size={18} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-semibold text-ink">
              ¿algo que te quieras poner hoy?
            </span>
            <span className="text-[15px] text-muted">
              lo armo alrededor de esa prenda
            </span>
          </span>
          <Icon name="chevron" size={17} className="ml-auto shrink-0 text-muted" />
        </button>
      )}
    </div>
  );
}

// Hoja del picker: chips de categoría + búsqueda + grid vertical 2-col. Escala a
// clósets grandes (vs. el scroll lateral infinito). Tocar una prenda la elige y
// cierra; tocar la elegida la quita.
function AnchorSheet({
  closet,
  selected,
  onSelect,
  onClose,
}: {
  closet: ClosetPick[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const cats = CAT_ORDER.filter((c) => closet.some((i) => i.category === c));
  const [cat, setCat] = useState<string>("todos");
  const [q, setQ] = useState("");
  const query = norm(q.trim());
  const filtered = closet.filter(
    (c) =>
      (cat === "todos" || c.category === cat) &&
      (query === "" || norm(c.nombre).includes(query))
  );
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end lg:items-center lg:justify-center bg-[rgb(10_10_10/0.45)]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Elegir una prenda"
    >
      <div
        className="flex max-h-[88dvh] flex-col rounded-t-[16px] bg-bg lg:w-full lg:max-w-[430px] lg:rounded-[16px]"
        style={{ animation: "var(--dur-medium) var(--ease-enter) sheet-up" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-none px-[18px] pt-3">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" />
          <div className="flex items-center gap-3">
            <h2 className="text-[18px] font-bold tracking-[-0.02em] text-ink">
              ¿algo que te quieras poner hoy?
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="ml-auto flex h-[34px] w-[34px] shrink-0 items-center justify-center border border-line text-ink transition-colors hover:border-ink"
            >
              <Icon name="equis" size={16} />
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2.5 border border-line bg-surface px-3.5 py-2.5 transition-colors focus-within:border-ink">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="busca una prenda"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-ink caret-accent outline-none placeholder:text-muted"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Limpiar búsqueda"
                className="shrink-0 text-muted hover:text-ink"
              >
                <Icon name="equis" size={14} />
              </button>
            ) : null}
          </label>
          <div className="-mx-[18px] mt-3 flex gap-2 overflow-x-auto px-[18px] pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {["todos", ...cats].map((c) => {
              const on = c === cat;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(c)}
                  aria-pressed={on}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    on
                      ? "border-accent bg-accent text-on-accent"
                      : "border-line bg-surface text-ink hover:border-ink"
                  }`}
                >
                  {c === "todos" ? "Todos" : (CAT_LABELS[c] ?? c)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-muted">
              nada por aquí — prueba otra categoría o búsqueda.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((c) => {
                const on = c.id === selected;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelect(on ? null : c.id)}
                    aria-pressed={on}
                    className={`relative aspect-[3/4] overflow-hidden rounded-md border text-left transition-colors ${
                      on ? "border-ink shadow-[inset_0_0_0_1px_var(--c-ink)]" : "border-line"
                    }`}
                  >
                    {c.imagen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.imagen}
                        alt={c.nombre}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span
                        className="block h-full w-full"
                        style={{ backgroundColor: c.swatch }}
                      />
                    )}
                    <span
                      className={`absolute right-2 top-2 flex h-[25px] w-[25px] items-center justify-center rounded-full border transition-colors ${
                        on
                          ? "border-accent bg-accent text-on-accent"
                          : "border-line bg-surface/85 text-transparent"
                      }`}
                    >
                      <Icon name="check" size={14} strokeWidth={2.6} />
                    </span>
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface/95 via-surface/80 to-transparent px-2.5 pb-2 pt-6 text-[11px] font-semibold text-ink">
                      {c.nombre}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
