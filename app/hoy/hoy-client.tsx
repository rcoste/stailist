"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LookDetail } from "@/components/look-detail";
import { TryonImmersive } from "@/components/tryon-immersive";
import { SkipReasons } from "@/components/skip-reasons";
import { StylistGenerating, type GenPlan } from "@/components/stylist-generating";
import { buildGenFrases } from "@/lib/gen-frases";
import {
  LookRequest,
  type LookInput,
  type ClosetPick,
  ocasionLabel,
  bucketLabel,
} from "@/components/weather-picker";
import { useWakeLock } from "@/lib/use-wake-lock";
import { markWorn, voteOutfit } from "@/lib/outfit-actions";
import { notifyFirstLike, notifyWorn } from "@/lib/pwa";
import { Icon } from "@/components/icon";
import { useTryon } from "@/lib/use-tryon";
import { AddSheet } from "@/components/add-sheet";
import { HomeCard } from "@/components/home-card";
import type { HomeCard as HomeCardData } from "@/lib/home-card";
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
  | { kind: "idle" } // aún sin look del día: home (saludo + CTA) DENTRO del AppShell,
  // con la tab bar visible — no fuerza el wizard ni atrapa al usuario.
  | { kind: "generating"; outfitId: string } // outfitId "" = aún sin id (POST en vuelo)
  | { kind: "ready"; outfit: HoyOutfit }
  // El ancla no va con la ocasión: el stylist avisa y la usuaria decide.
  | { kind: "anchor_warning"; note: string; seedItemName: string; input: LookInput }
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
  wornInicial,
  userId,
  defaultObjective,
  closet = [],
  autoAsk = false,
  homeCard = null,
  checklist = null,
}: {
  lookInicial: HoyOutfit | null;
  /** Look del día que está generándose en background (del server) → retomar polling. */
  pendingOutfitId?: string | null;
  /** Voto ligero del look del día (revivido: la apuesta de solo-comportamiento
   *  dejó el feedback en <10% — el 👍/👎 de un tap es la capa barata del embudo). */
  votoInicial?: "up" | "down" | null;
  wornInicial: boolean;
  userId: string;
  defaultObjective: string | null;
  /** Clóset para el picker de ancla del wizard ("¿algo que te quieras poner hoy?"). */
  closet?: ClosetPick[];
  /** Llegó por el botón ✨ (?generar=1): abre el form de una vez, en vez del look del día. */
  autoAsk?: boolean;
  /** Card contextual del home idle (viaje / prenda sin estrenar / ayer). UNA o ninguna. */
  homeCard?: HomeCardData | null;
  /** Checklist de activación (home idle): avatar → prendas → estilo → silueta →
   *  cápsula. null = todo hecho (se autodestruye). */
  checklist?: HomeChecklistData | null;
}) {
  const [state, setState] = useState<State>(
    pendingOutfitId && !autoAsk
      ? { kind: "generating", outfitId: pendingOutfitId }
      : autoAsk
        ? { kind: "ask" } // el botón ✨ sí abre el wizard de una
        : lookInicial
          ? { kind: "ready", outfit: lookInicial }
          : { kind: "idle" } // sin look del día → home, NO el wizard a la fuerza
  );
  // Pantalla despierta mientras se genera el look (no se auto-bloquea a media carga).
  useWakeLock(state.kind === "generating");
  const [worn, setWorn] = useState(wornInicial);
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
  // Ancla que viene de la card "aún no estrenas X": abre el wizard con esa
  // prenda ya seleccionada. Es estado (no ref) porque el wizard la renderiza.
  const [seedFromCard, setSeedFromCard] = useState<string | null>(null);
  // Cancela el polling en curso (al desmontar o al arrancar otro).
  const cancelPoll = useRef<(() => void) | null>(null);

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
            setState({ kind: "ready", outfit: data.outfit });
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

  const generar = useCallback(
    async (input: LookInput, force: boolean, forceAnchor = false) => {
      lastInput.current = input;
      lastForceAnchor.current = forceAnchor;
      cancelPoll.current?.();
      setState({ kind: "generating", outfitId: "" });
      setWorn(false);
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
          setState({ kind: "ready", outfit: data.outfit });
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
  function startGen(force: boolean, seedItemId: string | null = null) {
    pendingForce.current = force;
    setSeedFromCard(seedItemId);
    setState({ kind: "ask" });
  }

  // "Otro look": regenera con la MISMA ocasión (no es cambiar de ocasión, es
  // "este no, otro"). Cierra los chips de razón.
  function otroLook() {
    if (lastInput.current) generar(lastInput.current, true, lastForceAnchor.current);
    else startGen(true);
  }

  async function meLoPongo() {
    if (state.kind !== "ready" || worn) return;
    setWorn(true);
    const res = await markWorn(state.outfit.id);
    if (!res.ok) setWorn(false);
    else notifyWorn(); // pico máximo de compromiso → ofrecer el correo semanal
  }

  // Sin look del día (y no llegaste por el ✨): home dentro del AppShell, con la
  // tab bar visible. Saludo + CTA — no te fuerza el wizard ni te atrapa.
  if (state.kind === "idle") {
    return (
      <div className="flex min-h-[calc(100dvh-13rem)] flex-col lg:mx-auto lg:min-h-[calc(100dvh-16rem)] lg:max-w-md">
        {/* Editorial y tipográfico — SIN foto de fondo (no confundir con un
            outfit). El cuerpo va centrado vertical; el CTA al pie. */}
        <div className="flex flex-1 flex-col justify-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted">
            {fechaLabel || " "}
          </p>
          <h1 className="mt-4 text-[52px] font-bold leading-[0.96] tracking-[-0.035em] text-ink">
            tu look
            <br />
            de hoy,{" "}
            <em className="font-display font-normal italic tracking-normal">
              aún no
            </em>
          </h1>
          <p className="mt-5 max-w-[280px] text-[20px] leading-snug text-muted">
            dime tu plan y te lo dejo listo en segundos.
          </p>
        </div>
        {/* Pie de la pantalla: contexto → acción principal → acción secundaria.
            La card contextual (si la hay) informa; el CTA manda; añadir prendas
            es la acción #2 por frecuencia y va en jerarquía fantasma. */}
        <div className="flex flex-col gap-3 pb-2">
          {/* Checklist de activación: la superficie única para "qué sigue". Mientras
              esté presente, cubre "añade prendas" — por eso el AddSheet suelto de
              abajo se oculta (no duplicar la acción en la misma pantalla). */}
          {checklist ? <HomeChecklist checklist={checklist} /> : null}
          {homeCard ? (
            <HomeCard
              card={homeCard}
              onEstrena={(itemId) => startGen(true, itemId)}
            />
          ) : null}
          <button
            type="button"
            onClick={() => startGen(false)}
            className="flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-sm bg-accent text-base font-bold text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            armar mi look de hoy
            <Icon name="flecha" size={19} />
          </button>
          {/* Ya activado (checklist completo): el AddSheet vuelve como el atajo de
              agregado rápido. Durante la activación vive dentro del checklist. */}
          {checklist ? null : <AddSheet userId={userId} variant="ghost" />}
        </div>
      </div>
    );
  }

  if (state.kind === "ask") {
    return (
      <LookRequest
        title="Tu look de hoy"
        defaultObjective={defaultObjective}
        closet={closet}
        defaultSeedItemId={seedFromCard}
        onPick={(input) => {
          setSeedFromCard(null);
          generar(input, pendingForce.current);
        }}
        // Salir del wizard (paso 1): vuelve al look del día si lo hay, o al home
        // (estado idle, con la tab bar) — NUNCA a un loop que re-abra el wizard.
        onExit={() => {
          setSeedFromCard(null);
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
      worn={worn}
      fechaLabel={fechaLabel}
      // El voto persistido solo aplica al look con el que cargó la página; un
      // look recién generado arranca sin voto (el key resetea el estado).
      votoInicial={state.outfit.id === lookInicial?.id ? votoInicial : null}
      onMeLoPongo={meLoPongo}
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

// Vista del look listo (estado 6 + try-on oscuro 7/8). Va keyed por outfit.id
// en el padre para que, al generar otro look, el try-on arranque limpio.
// El try-on YA NO se muestra inline: la foto vive solo en el modal oscuro
// (revealMode "modal"), que es el único momento oscuro de la app.
function ReadyView({
  outfit,
  userId,
  worn,
  fechaLabel,
  votoInicial = null,
  onMeLoPongo,
  onOtroLook,
}: {
  outfit: HoyOutfit;
  userId: string;
  worn: boolean;
  /** "MARTES · 15 JUL" — para el eyebrow del spread de desktop. */
  fechaLabel: string;
  votoInicial?: "up" | "down" | null;
  onMeLoPongo: () => void;
  onOtroLook: () => void;
}) {
  const [skipOpen, setSkipOpen] = useState(false);
  // Hoja de razones: "skip" (desde "otro look") o "down" (desde el 👎). Misma
  // hoja, dos entradas — el 👎 captura el disgusto aunque no regenere.
  const [sheetMode, setSheetMode] = useState<"skip" | "down">("skip");
  // Voto ligero (etapa 1 del embudo): un tap, sin compromiso de ponérselo.
  const [voto, setVoto] = useState<"up" | "down" | null>(votoInicial);

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
    revealMode: "modal",
    returnTo: "/hoy",
  });
  // Pantalla despierta mientras se genera el try-on (~30s con Gemini).
  useWakeLock(t.mode === "gen");

  // El modal oscuro está abierto durante la generación, con la foto, o en error.
  const modalOpen = t.mode === "gen" || t.mode === "full" || t.mode === "error";

  // "Verte con este look": si ya hay foto, ábrela; si no, genérala (revealMode
  // "modal" abre el modal al terminar). Sin avatar → el CTA lleva al wizard.
  function verte() {
    if (t.image) t.openFull();
    else t.generar();
  }

  return (
    <>
      <div
        className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-[440px] flex-1 flex-col"
        style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
      >
        <LookDetail
          nombre={outfit.nombre}
          prendas={outfit.prendas}
          justificacion={outfit.explicacion}
          tip={outfit.tip ?? null}
          outfitId={outfit.id}
          initialFavorited={outfit.favorited ?? false}
          verme={
            t.mode === "sin_avatar"
              ? { href: t.avatarHref }
              : { onClick: verte, sub: "~20 s" }
          }
          voto={voto}
          onVote={votar}
          onOtroLook={() => {
            setSheetMode("skip");
            setSkipOpen(true);
          }}
        />
      </div>

      {skipOpen ? (
        <SkipReasons
          outfitId={outfit.id}
          mode={sheetMode}
          onProceed={onOtroLook}
          onClose={() => setSkipOpen(false)}
        />
      ) : null}

      {modalOpen ? (
        <TryonImmersive
          mode={t.mode === "full" ? "full" : t.mode === "error" ? "error" : "gen"}
          image={t.image}
          lookName={outfit.nombre}
          prendas={outfit.prendas}
          errMsg={t.errMsg}
          worn={worn}
          minimal
          onClose={t.closeFull}
          onRetry={t.generar}
          onOtro={() => {
            t.closeFull();
            onOtroLook();
          }}
          onMeLoPongo={onMeLoPongo}
          changeHref={t.avatarHref}
        />
      ) : null}
    </>
  );
}
