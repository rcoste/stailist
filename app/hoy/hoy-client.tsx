"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LookDetail } from "@/components/look-detail";
import { SkipReasons } from "@/components/skip-reasons";
import { StylistGenerating, type GenPlan } from "@/components/stylist-generating";
import { buildGenFrases } from "@/lib/gen-frases";
import {
  LookRequest,
  type LookInput,
  type ClosetPick,
  ocasionLabel,
  bucketLabel,
  fmtFechaLocal,
  fechaLegible,
} from "@/components/weather-picker";
import { useWakeLock } from "@/lib/use-wake-lock";
import { voteOutfit } from "@/lib/outfit-actions";
import { notifyFirstLike } from "@/lib/pwa";
import { Icon } from "@/components/icon";
import { useTryon } from "@/lib/use-tryon";
import { AddSheet, type AddSheetHandle } from "@/components/add-sheet";
import { EspejoFlow, type EspejoHandle } from "@/components/espejo-flow";
import { UltimoLookCard } from "@/components/ultimo-look-card";
import type { UltimoLook } from "@/lib/ultimo-look";
import { HomeTripCard } from "@/components/home-trip-card";
import type { HomeTrip } from "@/lib/home-trip";
import { HomeChecklist } from "@/components/home-checklist";
import type { HomeChecklist as HomeChecklistData } from "@/lib/home-checklist";

export type HoyOutfit = {
  id: string;
  nombre: string;
  explicacion: string;
  tip?: string | null; // "el toque" — cómo llevarlo (opcional)
  tryon?: string | null;
  favorited?: boolean;
  prendas: { id?: string | null; nombre: string; swatch: string; imagen?: string | null }[];
};

type State =
  | { kind: "ask" }
  // LA HOME CUANDO YA TIENES TU LOOK. Es el mismo lugar que "idle" —checklist,
  // card contextual, espejo, añadir— pero con el texto y el botón dicendo la
  // verdad: tu look existe y se va a VER, no a generar otra vez.
  //
  // Existía el agujero: al abrir /hoy con look del día se entraba en "ready" y
  // NO había camino de vuelta (el único setState idle es al salir del wizard, y
  // sólo si no hay look). O sea que en cuanto generabas, la home quedaba
  // inalcanzable el resto del día — y con ella el checklist de activación, que
  // es justo la superficie que guía a alguien nuevo. Lo reportó Roberto: "no
  // tengo una forma de ir a la homescreen".
  | { kind: "inicio" }
  | { kind: "idle" } // aún sin look del día: home (saludo + CTA) DENTRO del AppShell,
  // con la tab bar visible — no fuerza el wizard ni atrapa al usuario.
  | { kind: "generating"; outfitId: string } // outfitId "" = aún sin id (POST en vuelo)
  // paraFecha: el look recién generado es para OTRO día (plannedFor) — la vista
  // lo dice ("mañana") en vez de mentir con "hoy". Ausente = look de hoy.
  | { kind: "ready"; outfit: HoyOutfit; paraFecha?: string | null }
  // El ancla no va con la ocasión: el stylist avisa y la usuaria decide.
  | { kind: "anchor_warning"; note: string; seedItemName: string; input: LookInput }
  // NO es un error: es la respuesta. El clóset no da para el código de
  // vestimenta que pidió, y decírselo hoy vale más que un look que la deja mal
  // en la puerta. Por eso tiene estado propio y no un ERROR_COPY más.
  | { kind: "no_alcanza"; faltan: string[] }
  | { kind: "error"; code: string };

const ERROR_COPY: Record<string, string> = {
  sin_api_key: "El stylist todavía no está conectado. Vuelve en un momento.",
  closet_vacio: "Tu clóset quedó muy vacío para armar un look.",
  generacion: "El stylist está ocupado — dale otra oportunidad.",
  no_pude_guardar: "Armé tu look pero no pude guardarlo — inténtalo de nuevo.",
  red: "Se cortó la conexión — inténtalo de nuevo.",
};

export function HoyClient({
  lookInicial,
  pendingOutfitId,
  votoInicial = null,
  userId,
  defaultObjective,
  gender,
  workDressCode,
  desdeElQuiz,
  closet = [],
  autoAsk = false,
  homeTrip = null,
  ultimoLook = null,
  checklist = null,
  verInicio = false,
  hayPlaneado = false,
}: {
  lookInicial: HoyOutfit | null;
  /** Look del día que está generándose en background (del server) → retomar polling. */
  pendingOutfitId?: string | null;
  /** Voto ligero del look del día (revivido: la apuesta de solo-comportamiento
   *  dejó el feedback en <10% — el 👍/👎 de un tap es la capa barata del embudo). */
  votoInicial?: "up" | "down" | null;
  userId: string;
  defaultObjective: string | null;
  /** Las anclas de formalidad son distintas por género ("traje y corbata" vs "vestido largo"). */
  gender: "hombre" | "mujer" | null;
  /** Su código de vestimenta del trabajo; null = nunca se le ha preguntado. */
  workDressCode: string | null;
  /** Lo que dijo del trabajo en el quiz de vida, para el puente de la pregunta. */
  desdeElQuiz: string | null;
  /** Clóset para el picker de ancla del wizard ("¿algo que te quieras poner hoy?"). */
  closet?: ClosetPick[];
  /** Llegó por el botón ✨ (?generar=1): abre el form de una vez, en vez del look del día. */
  autoAsk?: boolean;
  /** Card de viaje del home — lo único contextual que queda (≤7 días o en curso). */
  homeTrip?: HomeTrip | null;
  /** El último look generado (card de zona 1, bajo el CTA). Tocarlo lo ABRE. */
  ultimoLook?: UltimoLook | null;
  /** Checklist de activación (home idle): avatar → prendas → estilo → silueta →
   *  cápsula. null = todo hecho (se autodestruye). */
  checklist?: HomeChecklistData | null;
  /** `?inicio=1`: abre la home aunque ya haya look del día (en vez del look). */
  verInicio?: boolean;
  /** Hay un look PLANEADO cerca de hoy (el server no conoce la zona horaria del
   *  dispositivo, así que solo avisa "pregunta tú"). El cliente hace el check
   *  con su fecha local y, si el planeado es de hoy, amanece como look del día. */
  hayPlaneado?: boolean;
}) {
  const [state, setState] = useState<State>(
    pendingOutfitId && !autoAsk
      ? { kind: "generating", outfitId: pendingOutfitId }
      : autoAsk
        ? { kind: "ask" } // el botón ✨ sí abre el wizard de una
        : verInicio && lookInicial
          ? { kind: "inicio" } // pidió la home teniéndolo ya (tab "Hoy" / título)
          : lookInicial
            ? { kind: "ready", outfit: lookInicial }
            : { kind: "idle" } // sin look del día → home, NO el wizard a la fuerza
  );
  const router = useRouter();
  // EL PARÁMETRO TIENE QUE ACTUAR, NO SÓLO LEERSE AL MONTAR.
  //
  // Tocar la pestaña "Hoy" estando en /hoy navega a /hoy?inicio=1, pero Next NO
  // remonta el componente cuando sólo cambia el query: el useState de arriba ya
  // corrió y el estado se quedaba en el look. La URL cambiaba y la pantalla no
  // — medido en el navegador, que es la única razón por la que me enteré.
  useEffect(() => {
    if (verInicio) setState({ kind: "inicio" });
  }, [verInicio]);

  // Pantalla despierta mientras se genera el look (no se auto-bloquea a media carga).
  useWakeLock(state.kind === "generating");
  // Fecha como eyebrow del empty state. Se calcula en cliente para evitar
  // desajuste de hidratación (la zona horaria del server puede diferir).
  const [fechaLabel, setFechaLabel] = useState("");
  useEffect(() => {
    const d = new Date();
    const wd = d.toLocaleDateString("es-MX", { weekday: "long" });
    const mo = d.toLocaleDateString("es-MX", { month: "short" }).replace(".", "");
    setFechaLabel(`${wd} · ${d.getDate()} ${mo}`.toUpperCase());
  }, []);
  // El botón ✨ pide un look NUEVO → fuerza (si no, look-of-day devuelve el cacheado).
  const lastInput = useRef<LookInput | null>(null);
  const pendingForce = useRef(autoAsk);
  // Recuerda si la usuaria ya aceptó usar el ancla pese al aviso de ocasión, para
  // no volver a avisarle en "otro look".
  const lastForceAnchor = useRef(false);
  // Cancela el polling en curso (al desmontar o al arrancar otro).
  const cancelPoll = useRef<(() => void) | null>(null);
  // Los flujos headless de la zona de recurrentes (los tiles los disparan).
  const espejoRef = useRef<EspejoHandle>(null);
  const addRef = useRef<AddSheetHandle>(null);

  // Polling del estado del look hasta que esté listo o falle. Sobrevive el
  // backgrounding: cuando vuelves a la app (o iOS la recarga), reanuda y encuentra
  // el resultado que el server siguió cocinando.
  const poll = useCallback((outfitId: string) => {
    cancelPoll.current?.();
    let stopped = false;
    cancelPoll.current = () => {
      stopped = true;
    };
    const tick = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/look-of-day?id=${outfitId}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (stopped) return;
          if (data.status === "ready" && data.outfit) {
            setState({
              kind: "ready",
              outfit: data.outfit,
              paraFecha: lastInput.current?.plannedFor ?? null,
            });
            return;
          }
          if (data.status === "no_alcanza") {
            // El clóset no da para ese código de vestimenta. Llega por el
            // polling porque la generación corre en background — antes este
            // caso se perdía y el placeholder moría por timeout a los 150s.
            setState({ kind: "no_alcanza", faltan: data.faltan ?? [] });
            return;
          }
          if (data.status === "error") {
            setState({ kind: "error", code: data.error ?? "generacion" });
            return;
          }
        }
      } catch {
        /* red intermitente — reintenta en el próximo tick */
      }
      if (!stopped) setTimeout(tick, 2200);
    };
    setTimeout(tick, 1800);
  }, []);

  // Retoma el polling si arrancamos en "generating" (look del día en background).
  useEffect(() => {
    if (state.kind === "generating" && state.outfitId) poll(state.outfitId);
    return () => cancelPoll.current?.();
    // Solo al montar: los cambios posteriores los maneja generar().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El look PLANEADO que amanece: si el server avisó que hay uno cerca de hoy y
  // la home abrió sin look, se pregunta con la fecha local del dispositivo (el
  // server corre en UTC y no puede saber qué día es AQUÍ). Si el planeado es de
  // hoy, se promueve a look del día y aparece — sin generar ni pagar nada.
  useEffect(() => {
    if (!hayPlaneado) return;
    if (lookInicial || pendingOutfitId || autoAsk) return;
    let muerto = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/look-of-day?promover=${fmtFechaLocal(new Date())}`,
          { cache: "no-store" }
        );
        if (!res.ok || muerto) return;
        const data = await res.json();
        if (!muerto && data.status === "ready" && data.outfit) {
          setState({ kind: "ready", outfit: data.outfit });
        }
      } catch {
        /* sin red no hay promoción — el look sigue planeado para el próximo intento */
      }
    })();
    return () => {
      muerto = true;
    };
    // Solo al montar: es un check de apertura, no una suscripción.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generar = useCallback(
    async (input: LookInput, force: boolean, forceAnchor = false) => {
      lastInput.current = input;
      lastForceAnchor.current = forceAnchor;
      cancelPoll.current?.();
      setState({ kind: "generating", outfitId: "" });
      try {
        const res = await fetch("/api/look-of-day", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, force, forceAnchor }),
        });
        if (!res.ok) {
          setState({ kind: "error", code: "generacion" });
          return;
        }
        const data = await res.json();
        if (data.error) {
          setState({ kind: "error", code: data.error });
          return;
        }
        if (data.status === "no_alcanza") {
          setState({ kind: "no_alcanza", faltan: data.faltan ?? [] });
          return;
        }
        // El ancla no va con la ocasión: muestra el aviso y deja decidir.
        if (data.status === "anchor_warning") {
          setState({
            kind: "anchor_warning",
            note: data.note,
            seedItemName: data.seedItemName,
            input,
          });
          return;
        }
        if (data.status === "ready" && data.outfit) {
          setState({
            kind: "ready",
            outfit: data.outfit,
            paraFecha: input.plannedFor ?? null,
          });
          return;
        }
        // En background → seguimos por polling.
        setState({ kind: "generating", outfitId: data.outfitId });
        poll(data.outfitId);
      } catch {
        setState({ kind: "error", code: "red" });
      }
    },
    [poll]
  );

  // Abre la pantalla de ocasión+clima y luego genera. Siempre la muestra (para
  // poder cambiar la ocasión cada vez). force = "Otro look".
  function startGen(force: boolean) {
    pendingForce.current = force;
    setState({ kind: "ask" });
  }

  // "Otro look": regenera con la MISMA ocasión (no es cambiar de ocasión, es
  // "este no, otro"). Cierra los chips de razón.
  function otroLook() {
    if (lastInput.current) generar(lastInput.current, true, lastForceAnchor.current);
    else startGen(true);
  }

  // Abre el último look desde su card (zona 1). VER no puede costar dinero:
  // si es el look del día ya cargado, se muestra directo; si no, GET ?id= ya
  // devuelve el outfit shaped (es lo que usa el polling) — un fetch y a la
  // vista ready, con su fecha como etiqueta para no mentir con "hoy".
  async function verUltimoLook() {
    if (!ultimoLook) return;
    const hoyLocal = fmtFechaLocal(new Date());
    const paraFecha =
      ultimoLook.fecha && ultimoLook.fecha !== hoyLocal ? ultimoLook.fecha : null;
    // Limpiar el ?inicio=1 es parte del arreglo, no cosmética: si se queda,
    // tocar la pestaña otra vez no navega (misma URL) y la home vuelve a ser
    // inalcanzable — el mismo bug del CTA viejo "ver mi look", más tarde.
    // Va ANTES de las dos ramas: al principio vivía solo en la del look del
    // día, así que abrir un look planeado desde la card dejaba el parámetro
    // puesto y el bug volvía por la puerta de atrás (lo cazó el review).
    if (verInicio) router.replace("/hoy", { scroll: false });
    if (lookInicial && ultimoLook.id === lookInicial.id) {
      setState({ kind: "ready", outfit: lookInicial });
      return;
    }
    try {
      const res = await fetch(`/api/look-of-day?id=${ultimoLook.id}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === "ready" && data.outfit) {
        setState({ kind: "ready", outfit: data.outfit, paraFecha });
      }
    } catch {
      /* sin red, la card simplemente no navega */
    }
  }

  // LA CENTRAL DE ACCIONES (rediseño 2026-08-11, handoff design_handoff_inicio).
  // El hero NUNCA asume "hoy": siempre pregunta "¿qué look armamos?" y el CTA
  // "crear un look" no desaparece nunca (el wizard es quien pregunta cuándo).
  // Lo que antes hacían el CTA doble ("ver mi look") y los chips de planeados
  // lo cubre UNA card de último look con imagen. Orden: crear → último look →
  // recurrentes (fit check dominante + añadir) → viaje ≤7 días → qué sigue.
  if (state.kind === "idle" || state.kind === "inicio") {
    // Entrada por jerarquía (README del handoff): fade + rise 8px, stagger de
    // 70ms de arriba hacia abajo. `both` para que el bloque no parpadee visible
    // durante su delay. prefers-reduced-motion lo apaga (globals: [style*=step-in]).
    const anim = (i: number): React.CSSProperties => ({
      animation: "var(--dur-medium) var(--ease-enter) step-in both",
      animationDelay: `${i * 70}ms`,
    });
    return (
      <div className="flex min-h-[calc(100dvh-12.5rem)] flex-col pb-2 lg:mx-auto lg:min-h-0 lg:max-w-md">
        {/* ─── ZONA 1: CREAR (el hero nunca asume "hoy") ─── */}
        <div className="pt-1" style={anim(0)}>
          <h1 className="text-[34px] font-bold leading-[1.06] tracking-[-0.03em] text-ink">
            ¿qué look{" "}
            <em className="font-display font-normal italic tracking-normal">
              armamos
            </em>
            ?
          </h1>
          <p className="mt-2 text-[14.5px] leading-[1.45] text-muted">
            para hoy, para mañana o para la boda del sábado — tú dime.
          </p>
        </div>

        {/* El CTA siempre CREA (el wizard pregunta cuándo). Ver el look que ya
            existe es trabajo de la card de abajo, no del botón.
            FUERZA cuando ya hay look del día, y esto NO es cosmético: con
            force=false, /api/look-of-day devuelve el look cacheado de hoy
            —ignorando la ocasión que la persona acaba de elegir— así que pedir
            "una boda" teniendo el look de la oficina contestaba con el de la
            oficina, sin error ni aviso. El botón del wizard (FAB) ya forzaba;
            este se quedó atrás al volverse el CTA único. */}
        <button
          type="button"
          onClick={() => startGen(!!lookInicial)}
          style={anim(1)}
          className="mt-4 flex min-h-14 w-full items-center justify-center gap-2.5 rounded-sm bg-accent text-[17px] font-bold text-on-accent transition-colors duration-200 hover:bg-accent-deep"
        >
          crear un look
          <Icon name="flecha" size={19} />
        </button>

        {/* El último look, como card con imagen (retrato del avatar o tira de
            prendas — lo decide el dato). Tocarla lo ABRE, nunca genera. */}
        {ultimoLook ? (
          <div className="mt-4" style={anim(2)}>
            <UltimoLookCard look={ultimoLook} onVer={verUltimoLook} />
          </div>
        ) : null}

        {/* ─── ZONA 2: LAS RECURRENTES (siempre visibles, un tap) ─── */}
        <div className="mt-4 flex flex-col gap-2.5" style={anim(3)}>
          {/* Fit check, EL PROTAGONISTA: ícono en tinta invertida + eyebrow. */}
          <button
            type="button"
            onClick={() => espejoRef.current?.start()}
            data-hint-target="hoy-fitcheck"
            className="flex items-center gap-3.5 rounded-lg border border-line bg-surface p-3.5 text-left transition-colors hover:border-ink"
          >
            <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-md bg-accent text-on-accent">
              <Icon name="camara" size={22} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-faint">
                fit check
              </span>
              <b className="text-xl font-bold tracking-[-0.02em] text-ink">
                ¿me veo{" "}
                <em className="font-display font-normal italic tracking-normal">
                  bien
                </em>{" "}
                hoy?
              </b>
              <span className="truncate text-[13px] text-muted">
                enséñame tu outfit y te digo — y me aprendo tus prendas
              </span>
            </span>
            <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
          </button>
          {/* Añadir prendas: tile delgado (el "planear otro día" murió — el CTA
              de arriba ya crea para cualquier día). */}
          <button
            type="button"
            onClick={() => addRef.current?.open()}
            className="flex items-center gap-3 rounded-md border border-line bg-surface px-3.5 py-[11px] text-left transition-colors hover:border-ink"
          >
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md bg-tile text-ink">
              <Icon name="mas" size={18} />
            </span>
            <span className="flex min-w-0 flex-col">
              <b className="text-[14.5px] font-bold text-ink">añadir prendas</b>
              <span className="text-[12.5px] text-muted">sube varias de golpe</span>
            </span>
            <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
          </button>
        </div>

        {/* ─── ZONA 3: EL VIAJE (solo a ≤7 días — lo único contextual) ─── */}
        {homeTrip ? (
          <div className="mt-3.5" style={anim(4)}>
            <HomeTripCard trip={homeTrip} />
          </div>
        ) : null}

        {/* ─── ZONA 4: QUÉ SIGUE (hairline, sin caja, pegado abajo; colapsa a
            una línea cuando ya hay look creado) ─── */}
        {checklist ? (
          <div className="mt-auto pt-6" style={anim(5)}>
            <HomeChecklist checklist={checklist} colapsado={!!ultimoLook} />
          </div>
        ) : null}

        {/* Flujos headless: los disparan los tiles de arriba. */}
        <EspejoFlow userId={userId} headless ref={espejoRef} />
        <AddSheet userId={userId} variant="headless" ref={addRef} />
      </div>
    );
  }

  if (state.kind === "ask") {
    return (
      <LookRequest
        title="Tu look de hoy"
        defaultObjective={defaultObjective}
        gender={gender}
        workDressCode={workDressCode}
        desdeElQuiz={desdeElQuiz}
        closet={closet}
        onPick={(input) => generar(input, pendingForce.current)}
        // Salir del wizard (paso 1): vuelve al look del día si lo hay, o al home
        // (estado idle, con la tab bar) — NUNCA a un loop que re-abra el wizard.
        onExit={() => {
          if (lookInicial) setState({ kind: "ready", outfit: lookInicial });
          else setState({ kind: "idle" });
        }}
      />
    );
  }

  if (state.kind === "generating") {
    const li = lastInput.current;
    let ocasionFrase = "armando algo a tu medida para hoy…";
    let plan: GenPlan | null = null;
    if (li) {
      ocasionFrase = li.plan
        ? `algo a tu medida para "${li.plan}"…`
        : (FRASES_ESTILISTA[li.objective] ?? ocasionFrase);
      plan = {
        ocasion: ocasionLabel(li.objective),
        momento: li.momento,
        clima: "weather" in li ? bucketLabel(li.weather.temp_c) : null,
      };
    }
    const frases = buildGenFrases(li, closet.length, ocasionFrase);
    return <StylistGenerating frases={frases} plan={plan} />;
  }

  if (state.kind === "no_alcanza") {
    const falta = state.faltan.join(", ");
    return (
      <div className="flex flex-col items-center gap-5 py-16 text-center lg:mx-auto lg:max-w-md">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-muted">
          <Icon name="gancho" size={22} />
        </span>
        <div className="flex flex-col gap-2">
          <p className="text-base text-ink">
            Para ese código de vestimenta te falta {falta}.
          </p>
          <p className="text-sm text-muted">
            No te armo algo que no va a funcionar ahí — mejor lo sabes hoy y no
            en la puerta.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href="/closet"
            className="flex min-h-12 items-center justify-center rounded-sm bg-accent px-8 text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            agregar esa prenda
          </Link>
          {/* La salida sin comprar nada: quizá el evento no era tan formal. */}
          <button
            type="button"
            onClick={() => setState({ kind: "ask" })}
            className="min-h-12 rounded-sm px-8 text-base font-medium text-muted transition-colors duration-200 hover:text-ink"
          >
            pedir otra cosa
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center lg:mx-auto lg:max-w-md">
        <p className="text-base text-ink">
          {ERROR_COPY[state.code] ?? ERROR_COPY.generacion}
        </p>
        {state.code === "closet_vacio" ? (
          // Reintentar con el mismo clóset vacío daría el mismo error → mándala a
          // agregar ropa, que es el camino de salida real.
          <Link
            href="/closet"
            className="flex min-h-12 items-center rounded-sm bg-accent px-8 text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            agregar ropa a tu clóset
          </Link>
        ) : state.code !== "sin_api_key" ? (
          <button
            type="button"
            onClick={() =>
              lastInput.current
                ? generar(lastInput.current, false)
                : setState({ kind: "ask" })
            }
            className="min-h-12 rounded-sm bg-accent px-8 text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            Reintentar
          </button>
        ) : null}
      </div>
    );
  }

  if (state.kind === "anchor_warning") {
    return (
      <div className="flex min-h-[calc(100dvh-13rem)] flex-col lg:mx-auto lg:min-h-[calc(100dvh-16rem)] lg:max-w-md">
        <div className="flex flex-1 flex-col justify-center gap-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-muted">
            <Icon name="gancho" size={22} />
          </span>
          <div className="flex flex-col gap-2.5">
            <h1 className="text-[28px] font-bold leading-[1.05] tracking-[-0.03em] text-ink">
              una cosa…
            </h1>
            <p className="max-w-[320px] text-[20px] leading-snug text-muted">
              {state.note}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 pb-2">
          <button
            type="button"
            onClick={() => generar(state.input, false, true)}
            className="flex min-h-[54px] items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
          >
            armar igual <Icon name="flecha" size={18} />
          </button>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => generar({ ...state.input, seedItemId: null }, false, false)}
              className="min-h-12 flex-1 rounded-sm border border-line bg-surface text-sm font-semibold text-ink transition-colors hover:border-ink"
            >
              mejor sin ella
            </button>
            <button
              type="button"
              onClick={() => {
                pendingForce.current = false;
                setState({ kind: "ask" });
              }}
              className="min-h-12 flex-1 rounded-sm border border-line bg-surface text-sm font-semibold text-ink transition-colors hover:border-ink"
            >
              elegir otra
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ReadyView
      key={state.outfit.id}
      outfit={state.outfit}
      userId={userId}
      paraFecha={state.paraFecha ?? null}
      fechaLabel={fechaLabel}
      // El voto persistido solo aplica al look con el que cargó la página; un
      // look recién generado arranca sin voto (el key resetea el estado).
      votoInicial={state.outfit.id === lookInicial?.id ? votoInicial : null}
      onOtroLook={otroLook}
    />
  );
}

// Frase de estilista del "generando", por ocasión (se escribe sola, typewriter).
const FRASES_ESTILISTA: Record<string, string> = {
  diario: "algo cómodo y resuelto para tu día, sin complicarte…",
  oficina: "algo pulido para tu oficina, sin que pierdas comodidad…",
  evento: "algo con presencia para tu evento, que se sienta muy tú…",
  refrescar: "una combinación distinta a la de siempre, bien fresca…",
};

// Vista del look listo. Va keyed por outfit.id en el padre para que, al generar
// otro look, el try-on arranque limpio. El render vive DENTRO del detalle (vista
// "así te queda"), no en un modal aparte: revealMode "inline".
function ReadyView({
  outfit,
  userId,
  paraFecha = null,
  fechaLabel,
  votoInicial = null,
  onOtroLook,
}: {
  outfit: HoyOutfit;
  userId: string;
  /** El look es para OTRO día (plannedFor): el título dice la fecha, no "hoy". */
  paraFecha?: string | null;
  /** "MARTES · 15 JUL" — para el eyebrow del spread de desktop. */
  fechaLabel: string;
  votoInicial?: "up" | "down" | null;
  onOtroLook: () => void;
}) {
  const [skipOpen, setSkipOpen] = useState(false);
  // Hoja de razones: "skip" (desde "otro look") o "down" (desde el 👎). Misma
  // hoja, dos entradas — el 👎 captura el disgusto aunque no regenere.
  const [sheetMode, setSheetMode] = useState<"skip" | "down">("skip");
  // Voto ligero (etapa 1 del embudo): un tap, sin compromiso de ponérselo.
  const [voto, setVoto] = useState<"up" | "down" | null>(votoInicial);
  // La promesa del fit check ("cuando te lo pongas, enséñamelo") dispara el
  // mismo flujo headless del home. Etapa 2 del embudo: reemplaza a la card
  // "¿te lo pusiste ayer?" — la señal de oro ahora se mide por cercanía.
  const espejoRef = useRef<EspejoHandle>(null);

  async function votar(up: boolean) {
    const prev = voto;
    const next = up ? "up" : "down";
    if (voto === next) return; // mismo voto = no-op (la action es idempotente)
    setVoto(next);
    // El voto se persiste ANTES de abrir la hoja del 👎: saveDownReason etiqueta
    // el evento del voto, así que el evento debe existir cuando elija la razón.
    const res = await voteOutfit(outfit.id, up);
    if (!res.ok) {
      setVoto(prev);
      return;
    }
    if (up) {
      notifyFirstLike(); // MVP: el prompt de instalar la PWA vive tras el primer 👍
    } else {
      setSheetMode("down");
      setSkipOpen(true);
    }
  }
  const t = useTryon({
    outfitId: outfit.id,
    userId,
    initialImage: outfit.tryon ?? null,
    revealMode: "inline",
    returnTo: "/hoy",
  });
  // Pantalla despierta mientras se genera el try-on (~30s con Gemini).
  useWakeLock(t.mode === "gen");

  return (
    <>
      {/* Acotado al alto visible (entre el header y la tab bar fija) para que el
          detalle QUEPA sin scroll y la fila de acciones nunca quede escondida
          detrás de la barra. -mb-28 cancela el pb-28 del <main> (reserva de la
          tab bar); en desktop (lg) se libera al layout normal.
          Vuelve a 7rem: la promesa del fit check dejó de ser una fila propia
          al pie (se fusionó con la de acciones), así que los ~40px que había
          que descontar por ella regresan a la foto. */}
      <div
        className="mx-auto -mb-28 flex h-[calc(100dvh-7rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-[440px] flex-col lg:mb-0 lg:h-auto lg:min-h-[calc(100dvh-9rem)]"
        style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
      >
        <LookDetail
          nombre={outfit.nombre}
          prendas={outfit.prendas}
          justificacion={outfit.explicacion}
          tip={outfit.tip ?? null}
          outfitId={outfit.id}
          initialFavorited={outfit.favorited ?? false}
          voto={voto}
          onVote={votar}
          onOtroLook={() => {
            setSheetMode("skip");
            setSkipOpen(true);
          }}
          tryonImage={t.image}
          generating={t.mode === "gen"}
          tryonError={t.mode === "error" ? t.errMsg : null}
          onGenerar={t.generar}
          avatarHref={t.mode === "sin_avatar" ? t.avatarHref : null}
          vermeSub="~20 s"
          seccionLabel={paraFecha ? fechaLegible(paraFecha) : undefined}
          onFitCheck={() => espejoRef.current?.start()}
        />
      </div>

      <EspejoFlow userId={userId} headless ref={espejoRef} />

      {skipOpen ? (
        <SkipReasons
          outfitId={outfit.id}
          mode={sheetMode}
          onProceed={onOtroLook}
          onClose={() => setSkipOpen(false)}
        />
      ) : null}
    </>
  );
}
