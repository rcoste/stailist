"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { OutfitCard } from "@/components/outfit-card";
import { TryonImmersive } from "@/components/tryon-immersive";
import { FavoriteButton } from "@/components/favorite-button";
import { SkipReasons } from "@/components/skip-reasons";
import { StylistGenerating, type GenPlan } from "@/components/stylist-generating";
import {
  LookRequest,
  type LookInput,
  ocasionLabel,
  bucketLabel,
} from "@/components/weather-picker";
import { useWakeLock } from "@/lib/use-wake-lock";
import { markWorn } from "@/lib/outfit-actions";
import { notifyFirstLike } from "@/lib/pwa";
import { Icon } from "@/components/icon";
import { useTryon } from "@/lib/use-tryon";

export type HoyOutfit = {
  id: string;
  nombre: string;
  explicacion: string;
  tip?: string | null; // "el toque" — cómo llevarlo (opcional)
  tryon?: string | null;
  favorited?: boolean;
  prendas: { nombre: string; swatch: string; imagen?: string | null }[];
};

type State =
  | { kind: "ask" }
  | { kind: "idle" } // aún sin look del día: home (saludo + CTA) DENTRO del AppShell,
  // con la tab bar visible — no fuerza el wizard ni atrapa al usuario.
  | { kind: "generating"; outfitId: string } // outfitId "" = aún sin id (POST en vuelo)
  | { kind: "ready"; outfit: HoyOutfit }
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
  wornInicial,
  userId,
  defaultObjective,
  autoAsk = false,
}: {
  lookInicial: HoyOutfit | null;
  /** Look del día que está generándose en background (del server) → retomar polling. */
  pendingOutfitId?: string | null;
  /** ya no se usa: el feedback de Hoy es comportamiento (otro look / me lo pongo). */
  votoInicial?: "up" | "down" | null;
  wornInicial: boolean;
  userId: string;
  defaultObjective: string | null;
  /** Llegó por el botón ✨ (?generar=1): abre el form de una vez, en vez del look del día. */
  autoAsk?: boolean;
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
    async (input: LookInput, force: boolean) => {
      lastInput.current = input;
      cancelPoll.current?.();
      setState({ kind: "generating", outfitId: "" });
      setWorn(false);
      try {
        const res = await fetch("/api/look-of-day", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, force }),
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
  function startGen(force: boolean) {
    pendingForce.current = force;
    setState({ kind: "ask" });
  }

  // "Otro look": regenera con la MISMA ocasión (no es cambiar de ocasión, es
  // "este no, otro"). Cierra los chips de razón.
  function otroLook() {
    if (lastInput.current) generar(lastInput.current, true);
    else startGen(true);
  }

  async function meLoPongo() {
    if (state.kind !== "ready" || worn) return;
    setWorn(true);
    const res = await markWorn(state.outfit.id);
    if (!res.ok) setWorn(false);
    else notifyFirstLike(); // ahora el pico emocional es el "me lo voy a poner"
  }

  // Sin look del día (y no llegaste por el ✨): home dentro del AppShell, con la
  // tab bar visible. Saludo + CTA — no te fuerza el wizard ni te atrapa.
  if (state.kind === "idle") {
    return (
      <div className="flex min-h-[calc(100dvh-13rem)] flex-col">
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
          <p className="mt-5 max-w-[280px] font-display text-[20px] leading-snug text-muted">
            dime tu plan y te lo dejo listo en segundos.
          </p>
        </div>
        <div className="pb-2">
          <button
            type="button"
            onClick={() => startGen(false)}
            className="flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-sm bg-accent text-base font-bold text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            armar mi look de hoy
            <Icon name="flecha" size={19} />
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === "ask") {
    return (
      <LookRequest
        title="Tu look de hoy"
        defaultObjective={defaultObjective}
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
    let frase = "armando algo a tu medida para hoy…";
    let plan: GenPlan | null = null;
    if (li) {
      frase = li.plan
        ? `algo a tu medida para "${li.plan}"…`
        : (FRASES_ESTILISTA[li.objective] ?? frase);
      plan = {
        ocasion: ocasionLabel(li.objective),
        momento: li.momento,
        clima: "weather" in li ? bucketLabel(li.weather.temp_c) : null,
      };
    }
    return <StylistGenerating frase={frase} plan={plan} />;
  }

  if (state.kind === "error") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-base text-ink">
          {ERROR_COPY[state.code] ?? ERROR_COPY.generacion}
        </p>
        {state.code !== "sin_api_key" && (
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
        )}
      </div>
    );
  }

  return (
    <ReadyView
      key={state.outfit.id}
      outfit={state.outfit}
      userId={userId}
      worn={worn}
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
  onMeLoPongo,
  onOtroLook,
}: {
  outfit: HoyOutfit;
  userId: string;
  worn: boolean;
  onMeLoPongo: () => void;
  onOtroLook: () => void;
}) {
  const [skipOpen, setSkipOpen] = useState(false);
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
    <div className="flex flex-col gap-4">
      <h1 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0">
        <span className="text-[25px] font-bold tracking-[-0.02em] text-ink">hoy</span>
        <span className="text-sm text-muted">·</span>
        <span className="font-display text-[22px] italic text-muted">{outfit.nombre}</span>
      </h1>

      <OutfitCard
        prendas={outfit.prendas.map((p) => ({ ...p, detalle: "" }))}
        justificacion={outfit.explicacion}
        tip={outfit.tip ?? null}
        corner={
          <FavoriteButton
            outfitId={outfit.id}
            initialFavorited={outfit.favorited ?? false}
          />
        }
      />

      {/* Footer: "verte con este look" protagonista + dos fantasma */}
      <div className="flex flex-col gap-2.5">
        {t.mode === "sin_avatar" ? (
          <Link
            href={t.avatarHref}
            className="flex min-h-[54px] items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
          >
            <Icon name="destello" size={18} /> crea tu avatar para verte
          </Link>
        ) : (
          <button
            type="button"
            onClick={verte}
            className="flex min-h-[54px] items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
          >
            <Icon name="destello" size={18} /> verte con este look
            <span className="text-[12px] font-semibold opacity-70">~20 s</span>
          </button>
        )}
        <div className="flex gap-2.5">
          {!worn && (
            <button
              type="button"
              onClick={() => setSkipOpen((v) => !v)}
              aria-pressed={skipOpen}
              className={`min-h-12 flex-1 rounded-sm border bg-surface text-sm font-semibold text-ink transition-colors ${
                skipOpen ? "border-ink" : "border-line hover:border-ink"
              }`}
            >
              otro look
            </button>
          )}
          <button
            type="button"
            onClick={onMeLoPongo}
            disabled={worn}
            className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-sm text-sm font-semibold transition-colors ${
              worn
                ? "bg-success/15 text-success"
                : "border border-line bg-surface text-ink hover:border-ink"
            }`}
          >
            {worn ? (
              <>
                <Icon name="check" size={18} /> es tu look
              </>
            ) : (
              "me lo pongo"
            )}
          </button>
        </div>
      </div>

      {skipOpen && !worn ? (
        <SkipReasons
          outfitId={outfit.id}
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
    </div>
  );
}
