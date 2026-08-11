"use client";

import { useState } from "react";
import { Spinner } from "@/components/spinner";
import { Icon, type IconName } from "@/components/icon";
import {
  WORK_DRESS_CODES,
  ropaDeDressCode,
  type WorkDressCode,
} from "@/lib/dress-code";
import { FORMALIDADES, ropaDeFormalidad, formalidadLegible } from "@/lib/formalidad";
import { TIPOS_EVENTO, formalidadDeEvento } from "@/lib/eventos";

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
  /**
   * QUÉ evento es (lib/eventos.ts). Reemplazó a preguntar el nivel de
   * formalidad a secas: una boda y una graduación son las dos "formal" y no se
   * resuelven igual — y sobre todo, la gente sabe decir "una boda" y no sabe
   * traducir "coctel" ni "etiqueta".
   */
  tipoEvento?: string | null;
  /** Va a llevar paraguas. Solo viaja cuando dijo que llueve. */
  paraguas?: boolean;
  /**
   * Su código de vestimenta del trabajo, si se le acaba de preguntar. Viaja
   * UNA vez —quien llama lo guarda en el perfil— y de ahí en adelante ya no se
   * pregunta: dónde trabajas no cambia cada mañana.
   */
  workDressCode?: WorkDressCode;
  /**
   * Solo cuando su código de trabajo es "variable": si HOY ve cliente. Es dato
   * del DÍA — elegir "depende del día" es justamente decir eso.
   */
  veCliente?: boolean;
  /**
   * Fecha calendario LOCAL del dispositivo (YYYY-MM-DD). Resuelve "hoy" en la
   * zona horaria de la persona — el server corre en UTC y a las 6pm de CDMX ya
   * cree que es mañana.
   */
  fechaLocal?: string;
  /**
   * Look pedido por adelantado: fecha futura (≤ ~16 días, el horizonte del
   * pronóstico). Ausente = hoy, el flujo de siempre. El look queda colgado a
   * esta fecha y ese día amanece siendo el look del día.
   */
  plannedFor?: string | null;
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

// El paso 1 habla en PLANES, no en categorías (rediseño 2026-08-10). Antes era
// un 2×2 abstracto ("el día a día / trabajo / un evento / refrescar") que
// obligaba a decidir si tu cena "cuenta como un evento" para llegar, dos
// niveles adentro, al catálogo que sí la entiende. Ahora: 2 planes cotidianos
// como cards + los planes sociales del catálogo (lib/eventos.ts) a la vista
// como chips. "refrescar" salió del wizard (nadie entendía qué prometía —
// tarea #14); si viene guardado del onboarding se trata como "diario", igual
// que "viaje". Sin "viaje": ya hay un Modo viaje propio.
const COTIDIANOS: { key: string; label: string; help: string; icon: IconName }[] = [
  { key: "diario", label: "un día normal", help: "lo de siempre, resuelto", icon: "camisa" },
  { key: "oficina", label: "trabajo", help: "verte pro sin pensarlo", icon: "maletin" },
];
const OCASION_KEYS = new Set([...COTIDIANOS.map((o) => o.key), "evento"]);

// Chips sociales: los frecuentes a la vista; los raros detrás de "otro…"
// (Roberto: "¿qué tantas veces vas a un funeral? — los poco frecuentes no
// ganan primera fila"). El orden es de frecuencia, no el del catálogo.
const PLANES_VISIBLES = [
  "cena-amigos",
  "cita",
  "comida-familiar",
  "comida-trabajo",
  "fiesta",
  "boda",
];

// Fecha calendario LOCAL del dispositivo. NUNCA toISOString(): esa es UTC y
// después de las 6pm (CDMX) ya es "mañana" — la misma trampa que tenía
// look_date en el server.
export function fmtFechaLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Hasta dónde se puede planear: el horizonte del pronóstico de Open-Meteo.
const DIAS_PLANEABLES = 16;

// La lista de días de la fila "para hoy ▾". key null = hoy (no viaja al server:
// hoy es el flujo de siempre, intacto).
function proximosDias(): { key: string | null; label: string }[] {
  const hoy = new Date();
  return Array.from({ length: DIAS_PLANEABLES + 1 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
    const label =
      i === 0
        ? "hoy"
        : i === 1
          ? "mañana"
          : `${d.toLocaleDateString("es-MX", { weekday: "short" }).replace(".", "")} ${d.getDate()}`;
    return { key: i === 0 ? null : fmtFechaLocal(d), label };
  });
}

// "el sábado 16" / "mañana" — para la fila cerrada, el copy del paso de clima y
// la etiqueta del look planeado en la vista del look (hoy-client).
export function fechaLegible(key: string): string {
  const [y, m, dd] = key.split("-").map(Number);
  const d = new Date(y, m - 1, dd);
  const hoy = new Date();
  const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  if (fmtFechaLocal(manana) === key) return "mañana";
  return `el ${d.toLocaleDateString("es-MX", { weekday: "long" })} ${d.getDate()}`;
}

// "Un evento" es ambiguo (de un coctel casual a una boda de etiqueta) y el motor
// adivinaba mal. Al elegir evento pedimos el nivel de formalidad para acertar.
// La tabla vive en lib/formalidad.ts — la comparten esta pantalla, el prompt,
// la rúbrica y la pantalla donde se califica el comparador. Vivía escrita en
// las cuatro y la cuarta se quedó atrás cuando el criterio cambió.
const FORMALIDAD = FORMALIDADES;
const ropaDe = ropaDeFormalidad;


// 5 bandas de temperatura (mismas de modo Viaje — set canónico, no inventar).
const BUCKETS = [
  { label: "Helado", ref: "para abrigo grueso", temp_c: 5 },
  { label: "Frío", ref: "suéter o chamarra", temp_c: 12 },
  { label: "Templado", ref: "manga larga ligera", temp_c: 19 },
  { label: "Cálido", ref: "playera, a gusto", temp_c: 25 },
  { label: "Caluroso", ref: "lo más fresco", temp_c: 33 },
];

// Etiquetas legibles del plan, reusadas por el "generando" (chips + frase).
// Conserva las keys viejas ("evento", "refrescar"): looks históricos las traen.
const OCASION_LABELS: Record<string, string> = {
  diario: "el día a día",
  oficina: "trabajo",
  evento: "un evento",
  refrescar: "refrescar",
};
export function ocasionLabel(key: string): string {
  return OCASION_LABELS[key] ?? key;
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
  gender = null,
  workDressCode = null,
  desdeElQuiz = null,
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
  /** Para las anclas de formalidad: la ropa concreta es distinta por género. */
  gender?: "hombre" | "mujer" | null;
  /** El que ya tiene guardado. null = nunca se le ha preguntado. */
  workDressCode?: string | null;
  /** Lo que dijo en el quiz de vida ("oficina creativa o casual"), para el puente. */
  desdeElQuiz?: string | null;
}) {
  // "viaje" (la opción "Aeropuerto" del onboarding) NO es una ocasión del wizard; se
  // trata como "diario" (look cómodo del día) para NO re-preguntar la ocasión al armar
  // el primer look — si no, el skip fallaba y volvía a pedir la ocasión ya elegida.
  // "refrescar" igual: salió del wizard, pero sigue guardado en perfiles viejos.
  const normObjective =
    defaultObjective === "viaje" || defaultObjective === "refrescar"
      ? "diario"
      : defaultObjective;
  const hasDefaultObj = !!(normObjective && OCASION_KEYS.has(normObjective));
  // "Evento" NUNCA se salta, aunque venga elegido del onboarding: es la única
  // ocasión que exige un dato más (la formalidad) y ese dato vive en el paso
  // que el skip se brincaba. O sea que quien elegía "un evento" en el
  // onboarding recibía su PRIMER look sin que nadie le preguntara si era una
  // boda de etiqueta o una cena — justo el hueco que hace incalificable el
  // resultado. Un tap de más para ellos; el resto no lo nota.
  const skip = !!skipObjective && hasDefaultObj && normObjective !== "evento";
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
  // La fecha del plan. null = hoy — el default silencioso: la fila "para hoy ▾"
  // se lee como suposición editable, no como pregunta. Solo fechas futuras
  // viajan al server (plannedFor).
  const [fecha, setFecha] = useState<string | null>(null);
  const [fechaOpen, setFechaOpen] = useState(false);
  // "otro…" revela los planes raros (graduación, funeral).
  const [masPlanes, setMasPlanes] = useState(false);
  // El TIPO de evento (boda, cena con amigos…). Es lo primero que se pregunta
  // al elegir "evento"; su formalidad sale del catálogo y solo se toca si el
  // caso es raro.
  const [tipoEvento, setTipoEvento] = useState<string | null>(null);
  // El AJUSTE manual de formalidad, cuando el default del tipo no aplica.
  // null = usar el del catálogo, que es lo normal.
  const [formalityManual, setFormalityManual] = useState<string | null>(null);
  // Solo se pregunta si NO lo tiene guardado, y solo al elegir "trabajo".
  const [dressCode, setDressCode] = useState<string | null>(null);
  // "¿hoy ves cliente?" — solo para quien dijo "depende del día". Sin esto el
  // motor se cubre en medio y sale mal por los dos lados: corto el día de
  // cliente, tieso el día que no.
  const [veCliente, setVeCliente] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locFailed, setLocFailed] = useState(false);

  // Campo abierto y tarjetas son mutuamente excluyentes (el "o" lo deja claro).
  const hasOpen = openText.trim().length > 0;
  const objectivePart: { objective: string; plan?: string } = hasOpen
    ? { objective: "diario", plan: openText.trim() }
    : { objective: objective ?? "diario" };

  // Trabajo exige su código de vestimenta la PRIMERA vez, por lo mismo que
  // evento exige formalidad: sin ese dato el motor adivina y el resultado no se
  // puede ni calificar. Después ya no se pregunta nunca.
  const pideDressCode = objective === "oficina" && !workDressCode;
  // El código efectivo: el guardado, o el que acaba de elegir en este mismo
  // paso (así la pregunta del día aparece de inmediato, sin esperar a la
  // siguiente sesión).
  const codigoHoy = workDressCode ?? dressCode;
  const pideVeCliente = objective === "oficina" && codigoHoy === "variable";
  // "Evento" exige elegir QUÉ evento es para avanzar (antes se pedía el nivel
  // de formalidad; ahora ese sale del catálogo y no hay que traducir jerga).
  const step1Ready =
    hasOpen ||
    (objective === "evento"
      ? !!tipoEvento
      : pideDressCode
        ? !!dressCode
        : !!objective);
  // La formalidad: la del catálogo según el tipo y el momento, salvo que la
  // haya ajustado a mano. El momento importa — una cena no es una comida.
  const formality =
    formalityManual ?? formalidadDeEvento(tipoEvento, momento) ?? null;
  const esEvento = objectivePart.objective === "evento" && !hasOpen;
  const formalityOut = esEvento ? formality : null;
  const tipoEventoOut = esEvento ? tipoEvento : null;

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
      onPick({
        ...objectivePart,
        momento,
        seedItemId,
        formality: formalityOut,
        tipoEvento: tipoEventoOut,
        ...(dressCode ? { workDressCode: dressCode as WorkDressCode } : {}),
        ...(pideVeCliente ? { veCliente } : {}),
        fechaLocal: fmtFechaLocal(new Date()),
        ...(fecha ? { plannedFor: fecha } : {}),
        ...coords,
      });
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
      tipoEvento: tipoEventoOut,
      ...(dressCode ? { workDressCode: dressCode as WorkDressCode } : {}),
      ...(pideVeCliente ? { veCliente } : {}),
      fechaLocal: fmtFechaLocal(new Date()),
      ...(fecha ? { plannedFor: fecha } : {}),
      weather: { temp_c: b.temp_c, condition: rain ? "lluvia" : "despejado" },
      ...(rain ? { paraguas } : {}),
    });
  }

  // Tarjetas y campo abierto son mutuamente excluyentes: elegir una ocasión
  // limpia el texto; escribir algo des-selecciona las tarjetas.
  function pickObjective(key: string) {
    setObjective((o) => (o === key ? null : key));
    setOpenText("");
    // El tipo de evento y su ajuste solo aplican a "evento": salirse de ahí
    // los limpia, o el siguiente evento heredaría la corrección del anterior.
    if (key !== "evento") {
      setTipoEvento(null);
      setFormalityManual(null);
    }
  }

  // Un chip social es objetivo + tipo en un solo tap (antes había que declarar
  // "un evento" primero — la clasificación que este rediseño mató).
  function pickPlanSocial(key: string) {
    const off = tipoEvento === key;
    setTipoEvento(off ? null : key);
    setObjective(off ? null : "evento");
    // Cambiar de plan reinicia el ajuste de formalidad: el default del tipo
    // nuevo es el bueno, no el que se corrigió para el anterior.
    setFormalityManual(null);
    setOpenText("");
  }
  function changeOpenText(v: string) {
    setOpenText(v);
    if (v.trim()) setObjective(null);
  }

  const displayStep = skip ? step - 1 : step;
  const meta = `PASO ${displayStep} DE ${totalSteps}`;
  // Titular con una palabra en serif itálica de acento (Instrument Serif).
  // El del paso 1 es temporalmente NEUTRO a propósito: la fila de fecha es la
  // única que puede decir "hoy" — el paso existe justo para no asumirlo.
  const question =
    step === 1 ? (
      <>
        ¿qué <em className={EM}>plan</em> tienes?
      </>
    ) : step === 2 ? (
      <>
        ¿de día o <em className={EM}>de noche</em>?
      </>
    ) : fecha ? (
      <>
        ¿cómo estará <em className={EM}>el clima</em>?
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
          {/* La fila de fecha: una suposición editable, no una pregunta. El
              default (hoy) no pide nada; tocarla abre la lista de días — lista,
              no calendario: 16 opciones se eligen en un tap. Oculta en el wow
              (el primer look es de hoy por definición). */}
          {step === 1 && !skip ? (
            <div className="mt-1">
              <button
                type="button"
                onClick={() => setFechaOpen((o) => !o)}
                aria-expanded={fechaOpen}
                aria-label={`cambiar el día — ${fecha ? `para ${fechaLegible(fecha)}` : "para hoy"}`}
                className={`inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold transition-colors hover:text-ink ${
                  fecha ? "text-ink" : "text-muted"
                }`}
              >
                {fecha ? `para ${fechaLegible(fecha)}` : "para hoy"}
                <Icon name="chevron" size={14} rotate={fechaOpen ? 270 : 90} />
              </button>
              {fechaOpen ? (
                <div
                  className="-mx-[18px] flex gap-2 overflow-x-auto px-[18px] pb-2"
                  style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
                >
                  {proximosDias().map((d) => {
                    const on = d.key === fecha || (!fecha && d.key === null);
                    return (
                      <button
                        key={d.label}
                        type="button"
                        onClick={() => {
                          setFecha(d.key);
                          setFechaOpen(false);
                        }}
                        aria-pressed={on}
                        className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-sm border px-3.5 text-[14px] font-semibold transition-colors ${
                          on
                            ? "border-accent bg-accent text-on-accent"
                            : "border-line bg-surface text-ink hover:border-ink"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Cuerpo scrollable (animado por paso) */}
        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-4 pt-[26px]">
          <div key={step} style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}>
            {step === 1 ? (
              <div className="flex flex-col gap-5">
                <StepOcasion
                  gender={gender}
                  objective={objective}
                  openText={openText}
                  tipoEvento={tipoEvento}
                  onPickPlanSocial={pickPlanSocial}
                  masPlanes={masPlanes}
                  onMasPlanes={() => setMasPlanes(true)}
                  formality={formality}
                  onFormalityManual={setFormalityManual}
                  pideDressCode={pideDressCode}
                  dressCode={dressCode}
                  onDressCode={setDressCode}
                  desdeElQuiz={desdeElQuiz}
                  pideVeCliente={pideVeCliente}
                  veCliente={veCliente}
                  onVeCliente={setVeCliente}
                  onPick={pickObjective}
                  onOpenText={changeOpenText}
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
                fechaLabel={fecha ? fechaLegible(fecha) : null}
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
  gender,
  objective,
  openText,
  tipoEvento,
  onPickPlanSocial,
  masPlanes,
  onMasPlanes,
  formality,
  onFormalityManual,
  pideDressCode,
  dressCode,
  onDressCode,
  desdeElQuiz,
  pideVeCliente,
  veCliente,
  onVeCliente,
  onPick,
  onOpenText,
}: {
  gender: "hombre" | "mujer" | null;
  objective: string | null;
  openText: string;
  tipoEvento: string | null;
  onPickPlanSocial: (k: string) => void;
  masPlanes: boolean;
  onMasPlanes: () => void;
  formality: string | null;
  onFormalityManual: (f: string | null) => void;
  pideDressCode: boolean;
  dressCode: string | null;
  onDressCode: (d: string) => void;
  desdeElQuiz: string | null;
  pideVeCliente: boolean;
  veCliente: boolean;
  onVeCliente: (v: boolean) => void;
  onPick: (key: string) => void;
  onOpenText: (v: string) => void;
}) {
  // Los frecuentes en el orden de PLANES_VISIBLES; los raros tras "otro…".
  const visibles = PLANES_VISIBLES.map((k) =>
    TIPOS_EVENTO.find((t) => t.key === k)
  ).filter((t): t is (typeof TIPOS_EVENTO)[number] => !!t);
  const raros = TIPOS_EVENTO.filter((t) => !PLANES_VISIBLES.includes(t.key));
  // Si el elegido es raro, se quedan a la vista aunque nadie tocara "otro…".
  const mostrarRaros = masPlanes || raros.some((t) => t.key === tipoEvento);

  const chip = (t: (typeof TIPOS_EVENTO)[number]) => {
    const on = tipoEvento === t.key;
    return (
      <button
        key={t.key}
        type="button"
        onClick={() => onPickPlanSocial(t.key)}
        aria-pressed={on}
        className={`min-h-[44px] rounded-sm border px-3.5 text-[14px] font-semibold transition-colors ${
          on
            ? "border-accent bg-accent text-on-accent"
            : "border-line bg-surface text-ink hover:border-ink"
        }`}
      >
        {t.label}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Los 2 planes cotidianos, como cards (estos SÍ llevan ícono siempre). */}
      <div className="grid grid-cols-2 gap-2.5">
        {COTIDIANOS.map((o) => {
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

      {/* Los planes sociales, A LA VISTA. Vienen del catálogo de eventos: cada
          uno trae su formalidad default ("la gente sabe decir 'una boda' y no
          sabe traducir 'coctel'"), así que elegir el chip ES contestar todo —
          el ajuste queda para el caso raro. Antes vivían dos niveles adentro,
          detrás de declarar "un evento". */}
      <div className="flex flex-col gap-2.5">
        <div className="my-0.5 flex items-center gap-2.5">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            o un plan social
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <div className="flex flex-wrap gap-2">
          {visibles.map(chip)}
          {mostrarRaros ? (
            raros.map(chip)
          ) : (
            <button
              type="button"
              onClick={onMasPlanes}
              aria-expanded={false}
              className="min-h-[44px] rounded-sm border border-line bg-surface px-3.5 text-[14px] font-semibold text-muted transition-colors hover:border-ink hover:text-ink"
            >
              otro…
            </button>
          )}
        </div>

        {/* El ajuste, detrás de un disclosure y con el default ya resuelto a
            la vista. Roberto: "si es una comida familiar, pues quién sabe;
            por alguna razón rara requiero traje sin corbata, pero no
            debería". Existe para ese caso, no para el normal. */}
        {tipoEvento ? (
            <details className="rounded-sm border border-line bg-surface px-3.5 py-2">
              <summary className="cursor-pointer text-[13px] text-muted">
                voy {formalidadLegible(formality, gender) ?? "normal"} · cambiar
              </summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {FORMALIDAD.map((f) => {
                  const on = formality === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => onFormalityManual(f.key)}
                      aria-pressed={on}
                      className={`flex flex-col items-start rounded-sm border px-3 py-1.5 text-left transition-colors ${
                        on
                          ? "border-accent bg-accent text-on-accent"
                          : "border-line bg-bg text-ink hover:border-ink"
                      }`}
                    >
                      <span className="text-[13px] font-semibold">
                        {ropaDe(f, gender)}
                      </span>
                      <span
                        className={`text-[11px] ${on ? "opacity-80" : "text-muted"}`}
                      >
                        {f.jerga}
                      </span>
                    </button>
                  );
                })}
              </div>
            </details>
        ) : null}
      </div>

      {/* El código de vestimenta del TRABAJO. Solo la primera vez: es un dato de
          persona, no de día. Roberto no pudo calificar un look de oficina en la
          corrida de verificación —"depende del tipo de oficina… el look está
          padre pero depende"— porque ni el motor ni él tenían el dato.
          Mismo patrón que la formalidad del evento: aparece al elegir, hay que
          contestarlo para avanzar, y las opciones dicen la ROPA, no la jerga. */}
      {pideDressCode ? (
        <div
          className="flex flex-col gap-2.5"
          style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
        >
          <span className="text-[13px] font-semibold text-ink">
            ¿cómo te vistes para trabajar?
          </span>
          <span className="-mt-1.5 text-[12px] text-muted">
            {/* El puente con lo que YA contestó en el quiz de estilo de vida.
                Sin él la pregunta se siente repetida y con razón: allá dijo
                "oficina creativa o casual" y aquí se le vuelve a preguntar por
                el trabajo. La diferencia es real —aquella describe la FORMA de
                su semana y esta el REGISTRO de su ropa— pero si no se dice,
                nadie la ve. */}
            {desdeElQuiz
              ? `dijiste que tu día es ${desdeElQuiz} — esto es qué significa en ropa`
              : "te lo pregunto una vez y lo recuerdo"}
          </span>
          <div className="flex flex-col gap-2">
            {WORK_DRESS_CODES.map((d) => {
              const on = dressCode === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => onDressCode(d.key)}
                  aria-pressed={on}
                  className={`flex flex-col items-start rounded-sm border px-3.5 py-2.5 text-left transition-colors ${
                    on
                      ? "border-accent bg-accent text-on-accent"
                      : "border-line bg-surface text-ink hover:border-ink"
                  }`}
                >
                  <span className="text-[14px] font-semibold">
                    {ropaDeDressCode(d, gender)}
                  </span>
                  <span
                    className={`text-[12px] ${on ? "opacity-80" : "text-muted"}`}
                  >
                    {d.ejemplos}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* "¿Hoy ves cliente?" — SOLO para quien dijo "depende del día". Elegir
          esa opción es la persona diciendo que su registro es dato del DÍA, no
          de ella; así que se le pregunta el día, igual que el paraguas. Cero
          fricción para los otros tres códigos. Roberto, que es este caso:
          "trabajo en home office pero cuando veo cliente me visto más formal".
          Default "no": es el día más común, y el que sí ve cliente ya sabe que
          hoy es distinto. */}
      {pideVeCliente ? (
        <div
          className="flex items-center gap-3 rounded-sm border border-line bg-surface p-3.5"
          style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
        >
          <span className="flex min-w-0 flex-col">
            <span className="text-[14px] font-semibold text-ink">
              ¿hoy ves cliente?
            </span>
            <span className="text-[12px] text-muted">
              me dijiste que depende del día
            </span>
          </span>
          <div className="ml-auto inline-flex shrink-0 overflow-hidden rounded-sm border border-line">
            <button
              type="button"
              onClick={() => onVeCliente(false)}
              aria-pressed={!veCliente}
              className={`min-h-[38px] px-5 text-[14px] font-semibold transition-colors ${
                !veCliente ? "bg-accent text-on-accent" : "bg-surface text-ink"
              }`}
            >
              no
            </button>
            <button
              type="button"
              onClick={() => onVeCliente(true)}
              aria-pressed={veCliente}
              className={`min-h-[38px] border-l border-line px-5 text-[14px] font-semibold transition-colors ${
                veCliente ? "bg-accent text-on-accent" : "bg-surface text-ink"
              }`}
            >
              sí
            </button>
          </div>
        </div>
      ) : null}

      {/* Campo abierto (alternativa). El placeholder invita al DICTADO: el
          micrófono del teclado del teléfono ya dicta aquí gratis — cero infra,
          y sin botón de mic propio (un mic que no graba es una mentira visual).
          Lo escrito/dictado viaja tal cual al motor como `plan`. Parsear fecha
          o plan del texto queda gateado a que el campo se use de verdad. */}
      <div className="flex flex-col">
        <div className="my-0.5 mb-2 flex items-center gap-2.5">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            o cuéntamelo con tus palabras
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
            placeholder={`escríbelo o díctalo — "concierto en la noche, algo cool"`}
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
  fechaLabel = null,
}: {
  /** null = nadie ha elegido todavía. Ver el comentario de `climaIdx`. */
  idx: number | null;
  rain: boolean;
  locating: boolean;
  locFailed: boolean;
  /** "el sábado 16" cuando el look es para otro día: la píldora lee el
   *  PRONÓSTICO de esa fecha (server, getWeatherForDates), no el clima de hoy. */
  fechaLabel?: string | null;
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
            {locating
              ? fechaLabel
                ? "leyendo el pronóstico…"
                : "leyendo el clima…"
              : "usar mi ubicación"}
          </span>
          <span className="text-[15px] text-muted">
            {locFailed
              ? "no pude leerla — dime tú abajo"
              : fechaLabel
                ? `leo el pronóstico de ${fechaLabel} por ti`
                : "leo temp y lluvia por ti"}
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
