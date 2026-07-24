"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { OutfitCard } from "@/components/outfit-card";
import { TryonImmersive } from "@/components/tryon-immersive";
import { FavoriteButton } from "@/components/favorite-button";
import { OnboardingProgress } from "@/components/onboarding-progress";
import { StylistGenerating, type GenPlan } from "@/components/stylist-generating";
import { buildGenFrases } from "@/lib/gen-frases";
import {
  LookRequest,
  type LookInput,
  ocasionLabel,
  bucketLabel,
} from "@/components/weather-picker";
import { markWorn, voteOutfit } from "@/lib/outfit-actions";
import { notifyFirstLike } from "@/lib/pwa";
import { useTryon } from "@/lib/use-tryon";
import { useWakeLock } from "@/lib/use-wake-lock";
import { Icon } from "@/components/icon";
import { StyleReferenceCard } from "@/components/style-reference-card";

export type WowOutfit = {
  id: string;
  nombre: string;
  explicacion: string;
  tip?: string | null;
  tryon?: string | null;
  prendas: { nombre: string; swatch: string; imagen?: string | null }[];
};

type State =
  | { kind: "ask" }
  // generating + streaming colapsados: acumulamos los outfits y mostramos la
  // pantalla de "tu estilista está pensando" hasta tenerlos todos (no se puede
  // elegir entre 1; los 3 se revelan juntos en "choosing").
  | { kind: "loading"; outfits: WowOutfit[]; phase: string; input: LookInput }
  | { kind: "choosing"; outfits: WowOutfit[]; chosenId: string }
  | { kind: "viewing"; outfits: WowOutfit[]; chosenId: string }
  // Post-primer-outfit: beat OPCIONAL de estilo de referencia (subir fotos de un
  // look que te encanta). Va DESPUÉS de "me lo pongo" — ya probaste valor, así
  // que pedir una foto ahora es engagement, no fricción antes del valor.
  | { kind: "referencia" }
  | { kind: "error"; code: string };

const ERROR_COPY: Record<string, string> = {
  sin_api_key:
    "El stylist todavía no está conectado (falta la API key de Anthropic). En cuanto esté, aquí nacen tus looks.",
  closet_vacio:
    "Tu clóset quedó muy vacío para armar looks — vuelve y marca al menos 3 básicos.",
  generacion: "El stylist está ocupado — dale otra oportunidad en un momento.",
  no_pude_guardar:
    "Armé tus looks pero no pude guardarlos — inténtalo de nuevo.",
  red: "Se cortó la conexión — inténtalo de nuevo.",
};

// Frase del "generando" del wow (typewriter), por ocasión.
const FRASES_ESTILISTA: Record<string, string> = {
  diario: "armando tus primeros looks con lo que ya tienes…",
  oficina: "armando algo pulido para tu oficina, con tu clóset…",
  evento: "armando algo con presencia para tu evento, muy tú…",
  refrescar: "armando combinaciones distintas a las de siempre…",
};

export function WowClient({
  initialOutfits,
  userId,
  defaultObjective,
  hasAvatar,
  closetCount,
}: {
  initialOutfits: WowOutfit[] | null;
  userId: string;
  defaultObjective: string | null;
  hasAvatar: boolean;
  /** Nº de prendas del clóset — para la frase "revisando tus N prendas…". */
  closetCount: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>(
    initialOutfits && initialOutfits.length > 0
      ? { kind: "choosing", outfits: initialOutfits, chosenId: initialOutfits[0].id }
      : { kind: "ask" }
  );
  const lastInput = useRef<LookInput | null>(null);

  const generate = useCallback(async (input: LookInput) => {
    lastInput.current = input;
    setState({ kind: "loading", outfits: [], phase: "preparando al stylist…", input });
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok || !res.body) {
        setState({ kind: "error", code: "generacion" });
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
          if (evt.outfit) {
            setState((s) =>
              s.kind === "loading"
                ? { ...s, outfits: [...s.outfits, evt.outfit as WowOutfit] }
                : s
            );
          } else if (evt.phase) {
            setState((s) =>
              s.kind === "loading" ? { ...s, phase: evt.phase } : s
            );
          } else if (evt.error) {
            setState({ kind: "error", code: evt.error });
            return;
          } else if (evt.done) {
            // Listos los 3 (o los que haya): se revelan juntos para elegir uno.
            setState((s) =>
              s.kind === "loading" && s.outfits.length > 0
                ? { kind: "choosing", outfits: s.outfits, chosenId: s.outfits[0].id }
                : { kind: "error", code: "red" }
            );
            return;
          }
        }
      }
      setState((s) =>
        s.kind === "loading" && s.outfits.length > 0
          ? { kind: "choosing", outfits: s.outfits, chosenId: s.outfits[0].id }
          : { kind: "error", code: "red" }
      );
    } catch {
      setState({ kind: "error", code: "red" });
    }
  }, []);

  // ─── ask: ocasión/clima (la ocasión ya se eligió antes → skipObjective) ───
  // Sin OnboardingProgress aquí: LookRequest trae su propio progreso de 2 pasos
  // (momento → clima) y su propio chrome; superponer la barra 5/5 era redundante.
  if (state.kind === "ask") {
    return (
      <LookRequest
        title="Antes de armar tu primer look…"
        defaultObjective={defaultObjective}
        onPick={generate}
        skipObjective
      />
    );
  }

  // ─── loading: "tu estilista está pensando" (reciclado de Hoy) ───
  if (state.kind === "loading") {
    const li = state.input;
    const ocasionFrase = li.plan
      ? `algo a tu medida para "${li.plan}"…`
      : (FRASES_ESTILISTA[li.objective] ?? "armando tus primeros looks con lo que ya tienes…");
    const plan: GenPlan = {
      ocasion: ocasionLabel(li.objective),
      momento: li.momento,
      clima: "weather" in li ? bucketLabel(li.weather.temp_c) : null,
    };
    const frases = buildGenFrases(li, closetCount, ocasionFrase);
    return <StylistGenerating frases={frases} plan={plan} />;
  }

  // ─── error ───
  if (state.kind === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-base text-ink">
          {ERROR_COPY[state.code] ?? ERROR_COPY.generacion}
        </p>
        {state.code !== "sin_api_key" && (
          <button
            type="button"
            onClick={() =>
              lastInput.current
                ? generate(lastInput.current)
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

  // ─── referencia: beat opcional de estilo de referencia, ya entrando a la app ───
  if (state.kind === "referencia") {
    return <ReferenceBeat onEnter={() => router.push("/hoy")} />;
  }

  // ─── viewing: el elegido, en modo Hoy ───
  if (state.kind === "viewing") {
    const outfit = state.outfits.find((o) => o.id === state.chosenId) ?? state.outfits[0];
    return (
      <ModoHoyView
        key={outfit.id}
        outfit={outfit}
        userId={userId}
        hasAvatar={hasAvatar}
        onOtroLook={() =>
          setState({ kind: "choosing", outfits: state.outfits, chosenId: state.chosenId })
        }
        // "me lo pongo" ya no salta directo a /hoy: pasa por el beat opcional.
        onCommitted={() => setState({ kind: "referencia" })}
      />
    );
  }

  // ─── choosing: elegir 1 de 3 ───
  const { outfits, chosenId } = state;
  const chosen = outfits.find((o) => o.id === chosenId) ?? outfits[0];
  return (
    <div className="flex flex-1 flex-col">
      <OnboardingProgress step={5} />

      <div className="mt-6 flex flex-col gap-1.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          Tus primeros looks
        </p>
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
          ¿con cuál <em className="font-display font-normal italic">empezamos</em>?
        </h1>
        <p className="text-[15px] text-muted">
          guarda tus favoritos · elige uno para verlo hoy.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {outfits.map((o) => {
          const sel = o.id === chosenId;
          return (
            <div
              key={o.id}
              className={`relative rounded-md border bg-surface transition-colors ${
                sel ? "border-ink" : "border-line"
              }`}
            >
              {sel ? (
                <span
                  aria-hidden
                  className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-md bg-ink"
                />
              ) : null}
              <div className="absolute right-3 top-3 z-10">
                <FavoriteButton outfitId={o.id} initialFavorited={false} />
              </div>
              <button
                type="button"
                onClick={() =>
                  setState({ kind: "choosing", outfits, chosenId: o.id })
                }
                aria-pressed={sel}
                className="flex w-full flex-col gap-3 p-3.5 text-left"
              >
                <span className="flex items-center gap-2.5 pr-10">
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      sel
                        ? "border-ink bg-ink text-on-accent"
                        : "border-muted"
                    }`}
                  >
                    {sel ? <Icon name="check" size={12} strokeWidth={3} /> : null}
                  </span>
                  <span className="text-[18px] font-bold leading-tight tracking-[-0.02em] text-ink">
                    <EditorialName name={o.nombre} />
                  </span>
                </span>
                <span className="flex gap-2">
                  {o.prendas.slice(0, 4).map((p, i) => (
                    <span
                      key={`${o.id}-${i}`}
                      className="relative aspect-[3/4] flex-1 overflow-hidden rounded-sm border border-line bg-bg"
                    >
                      {p.imagen ? (
                        <Image
                          src={p.imagen}
                          alt={p.nombre}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <span
                          className="absolute inset-0"
                          style={{ backgroundColor: p.swatch }}
                          aria-hidden
                        />
                      )}
                    </span>
                  ))}
                </span>
                <span className="editorial text-sm text-muted">{o.explicacion}</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-auto border-t border-line bg-bg px-4 pb-2 pt-3">
        <button
          type="button"
          onClick={() => setState({ kind: "viewing", outfits, chosenId })}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
        >
          empezar con «{chosen.nombre}»
          <Icon name="flecha" size={18} />
        </button>
      </div>
    </div>
  );
}

// Nombre del look con la última palabra en serif itálica (acento editorial v3).
function EditorialName({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return <>{name}</>;
  const last = parts.pop() as string;
  return (
    <>
      {parts.join(" ")}{" "}
      <em className="font-display font-normal italic">{last}</em>
    </>
  );
}

// El look elegido, en el MISMO patrón que ReadyView de Hoy: header "hoy · nombre"
// + grid de prendas (OutfitCard) + "verme con este look" + otro look / me lo pongo.
// Diferencias del onboarding: aún no hay avatar (el "verme" abre el wizard) y
// "otro look" no regenera (cuesta) — vuelve a elegir entre los 3 ya generados.
function ModoHoyView({
  outfit,
  userId,
  hasAvatar,
  onOtroLook,
  onCommitted,
}: {
  outfit: WowOutfit;
  userId: string;
  hasAvatar: boolean;
  onOtroLook: () => void;
  onCommitted: () => void;
}) {
  const [worn, setWorn] = useState(false);
  // Voto ligero de un tap (etapa 1 del embudo, igual que en Hoy): captura la
  // señal de gusto SIN exigir el compromiso de "me lo pongo".
  const [voto, setVoto] = useState<"up" | "down" | null>(null);
  const t = useTryon({
    outfitId: outfit.id,
    userId,
    initialImage: outfit.tryon ?? null,
    revealMode: "modal",
    returnTo: "/onboarding/wow",
  });
  useWakeLock(t.mode === "gen");

  async function votar(up: boolean) {
    const prev = voto;
    const next = up ? "up" : "down";
    if (voto === next) return; // mismo voto = no-op (la action es idempotente)
    setVoto(next);
    const res = await voteOutfit(outfit.id, up);
    if (!res.ok) {
      setVoto(prev);
      return;
    }
    if (up) notifyFirstLike(); // spec: el prompt de instalar la PWA vive tras el primer 👍
  }

  const modalOpen = t.mode === "gen" || t.mode === "full" || t.mode === "error";
  // Sin avatar todavía (caso normal del onboarding) → el "verme" lleva al wizard.
  const goAvatar = !hasAvatar || t.mode === "sin_avatar";

  function verte() {
    if (t.image) t.openFull();
    else t.generar();
  }

  async function meLoPongo() {
    if (worn) return;
    setWorn(true);
    const res = await markWorn(outfit.id);
    if (!res.ok) {
      setWorn(false);
      return;
    }
    notifyFirstLike(); // pico emocional → ofrecer instalar la PWA
    onCommitted(); // beat opcional de estilo de referencia antes de entrar a /hoy
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <h1 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0">
        <span className="text-[25px] font-bold tracking-[-0.02em] text-ink">hoy</span>
        <span className="text-sm text-muted">·</span>
        <span className="font-display text-[22px] italic text-muted">{outfit.nombre}</span>
      </h1>

      <OutfitCard
        prendas={outfit.prendas.map((p) => ({ ...p, detalle: "" }))}
        justificacion={outfit.explicacion}
        tip={outfit.tip ?? null}
        corner={<FavoriteButton outfitId={outfit.id} initialFavorited={false} />}
      />

      <div className="flex flex-col gap-2.5">
        {goAvatar ? (
          <Link
            href={t.avatarHref}
            className="flex min-h-[54px] items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
          >
            <Icon name="destello" size={18} /> verme con este look
          </Link>
        ) : (
          <button
            type="button"
            onClick={verte}
            className="flex min-h-[54px] items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
          >
            <Icon name="destello" size={18} /> verme con este look
            <span className="text-[12px] font-semibold opacity-70">~20 s</span>
          </button>
        )}
        {/* Voto ligero de un tap (igual que en Hoy): "me gustó" sin el
            compromiso de "me lo pongo". El 👍 dispara el prompt de la PWA. */}
        <div className="flex items-center justify-center gap-4 py-0.5">
          <span className="text-[13px] text-muted">¿te late?</span>
          <button
            type="button"
            onClick={() => votar(true)}
            aria-pressed={voto === "up"}
            aria-label="me gusta este look"
            className={`flex h-10 w-10 items-center justify-center rounded-sm border transition-colors ${
              voto === "up"
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-muted hover:border-ink hover:text-ink"
            }`}
          >
            <Icon name="pulgar" size={17} />
          </button>
          <button
            type="button"
            onClick={() => votar(false)}
            aria-pressed={voto === "down"}
            aria-label="no me gusta este look"
            className={`flex h-10 w-10 items-center justify-center rounded-sm border transition-colors ${
              voto === "down"
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-muted hover:border-ink hover:text-ink"
            }`}
          >
            <Icon name="pulgar" size={17} className="rotate-180" />
          </button>
        </div>

        {/* Entrar a la app NO exige "me lo pongo": "seguir" avanza sin marcar
            worn (antes la única puerta era "me lo pongo", que falseaba la señal
            de oro del experimento). "me lo pongo hoy" queda abajo como señal
            honesta y opcional, no como peaje. */}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onOtroLook}
            className="min-h-12 flex-1 rounded-sm border border-line bg-surface text-sm font-semibold text-ink transition-colors hover:border-ink"
          >
            otro look
          </button>
          <button
            type="button"
            onClick={onCommitted}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-sm border border-ink bg-surface text-sm font-bold text-ink transition-colors hover:bg-ink hover:text-on-accent"
          >
            seguir <Icon name="flecha" size={16} />
          </button>
        </div>

        <button
          type="button"
          onClick={meLoPongo}
          disabled={worn}
          className={`mx-auto flex min-h-11 items-center justify-center gap-2 rounded-sm px-4 text-sm font-semibold transition-colors ${
            worn ? "text-success" : "text-muted hover:text-ink"
          }`}
        >
          {worn ? (
            <>
              <Icon name="check" size={16} /> es tu look
            </>
          ) : (
            "ya me lo puse hoy"
          )}
        </button>
      </div>

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
          onMeLoPongo={meLoPongo}
          changeHref={t.avatarHref}
        />
      ) : null}
    </div>
  );
}

// Beat opcional post-primer-outfit: promueve el estilo de referencia (subir
// fotos de un look que te encanta) en el momento de mayor engagement — justo
// después de que la persona se "puso" su primer look. Reusa StyleReferenceCard
// (upload → preview → guardar, con veredicto honesto de si le va). "entrar a la
// app" está SIEMPRE disponible: suba o no, el paso es 100% opcional y no
// bloquea. Antes esta feature vivía enterrada en Perfil y nadie la encontraba.
function ReferenceBeat({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="flex flex-1 flex-col gap-5 pb-4 pt-2">
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          una cosa más · opcional
        </p>
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
          afina tu estilo aún <em className="font-display font-normal italic">más</em>
        </h1>
      </div>

      <StyleReferenceCard initial={null} />

      <div className="sticky bottom-0 z-20 -mx-4 mt-auto border-t border-line bg-bg px-4 pb-2 pt-3">
        <button
          type="button"
          onClick={onEnter}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
        >
          entrar a la app <Icon name="flecha" size={18} />
        </button>
      </div>
    </div>
  );
}
