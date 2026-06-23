"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OutfitCard } from "@/components/outfit-card";
import { TryonModal } from "@/components/tryon-modal";
import { FavoriteButton } from "@/components/favorite-button";
import { SkipReasons } from "@/components/skip-reasons";
import { GeneratingScreen, type GenPhrase } from "@/components/generating-screen";
import { LookRequest, type LookInput } from "@/components/weather-picker";
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
  const router = useRouter();
  const [state, setState] = useState<State>(
    pendingOutfitId && !autoAsk
      ? { kind: "generating", outfitId: pendingOutfitId }
      : autoAsk || !lookInicial
        ? { kind: "ask" }
        : { kind: "ready", outfit: lookInicial }
  );
  // Pantalla despierta mientras se genera el look (no se auto-bloquea a media carga).
  useWakeLock(state.kind === "generating");
  const [worn, setWorn] = useState(wornInicial);
  const [skipOpen, setSkipOpen] = useState(false);
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
      setSkipOpen(false);
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
    setSkipOpen(false);
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

  if (state.kind === "ask") {
    return (
      <LookRequest
        title="Tu look de hoy"
        defaultObjective={defaultObjective}
        onPick={(input) => generar(input, pendingForce.current)}
        // Salir del wizard (paso 1): vuelve a Hoy — muestra el look del día si lo
        // hay, o reinicia el wizard si aún no hay look.
        onExit={() => {
          if (lookInicial) setState({ kind: "ready", outfit: lookInicial });
          else router.push("/hoy");
        }}
      />
    );
  }

  if (state.kind === "generating") {
    return <GeneratingScreen phrases={HOY_PHRASES} />;
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
    <div className="flex flex-col gap-4">
      <h1 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0">
        <span className="text-h2 font-semibold text-ink">Hoy</span>
        <span className="text-sm font-normal text-muted">·</span>
        <span className="editorial text-h3 text-accent">{state.outfit.nombre}</span>
      </h1>
      <TryonOutfitCard
        key={state.outfit.id}
        outfit={state.outfit}
        userId={userId}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSkipOpen((v) => !v)}
          aria-pressed={skipOpen}
          className={`flex min-h-12 flex-1 items-center justify-center rounded-sm border text-sm font-medium transition-colors duration-200 ${
            skipOpen
              ? "border-accent bg-accent-soft text-ink"
              : "border-line bg-surface text-ink hover:border-ink"
          }`}
        >
          Otro look
        </button>
        <button
          type="button"
          onClick={meLoPongo}
          disabled={worn}
          className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-sm text-sm font-medium transition-colors duration-200 ${
            worn
              ? "bg-success/15 text-success"
              : "bg-accent text-on-accent hover:bg-accent-deep"
          }`}
        >
          {worn ? (
            <>
              <Icon name="check" size={18} /> Es tu look de hoy
            </>
          ) : (
            "Me lo voy a poner"
          )}
        </button>
      </div>
      {skipOpen && !worn ? (
        <SkipReasons
          outfitId={state.outfit.id}
          onProceed={otroLook}
          onClose={() => setSkipOpen(false)}
        />
      ) : null}
    </div>
  );
}

// Frases de "generando" para Hoy (lenguaje como progreso, palabra clave en acento).
const HOY_PHRASES: GenPhrase[] = [
  { a: "leyendo tu ", k: "clóset", b: "…" },
  { a: "combinando tus ", k: "colores", b: "…" },
  { a: "cuidando el ", k: "clima", b: "…" },
  { a: "afinando los ", k: "detalles", b: "…" },
  { a: "puliendo tu ", k: "look", b: "…" },
];

// Card del outfit con el try-on integrado (3 estados). Va keyed por outfit.id
// en el padre para que, al generar otro look, el try-on arranque limpio con la
// imagen (o no) del nuevo outfit.
function TryonOutfitCard({
  outfit,
  userId,
}: {
  outfit: HoyOutfit;
  userId: string;
}) {
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
        tryon={{
          status: t.mode,
          image: t.image,
          errMsg: t.errMsg,
          lookName: outfit.nombre,
          onGenerate: t.generar,
          onExpand: t.openFull,
          changeHref: t.avatarHref,
        }}
      />
      {t.image ? (
        <Link
          href={t.avatarHref}
          className="self-start text-xs font-medium text-muted underline underline-offset-4 hover:text-ink"
        >
          ¿No te pareces? Cambia tu avatar
        </Link>
      ) : null}
      {t.mode === "full" && t.image ? (
        <TryonModal
          image={t.image}
          lookName={outfit.nombre}
          onClose={t.closeFull}
          changeHref={t.avatarHref}
        />
      ) : null}
    </>
  );
}
