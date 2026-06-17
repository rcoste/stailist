"use client";

import { useCallback, useRef, useState } from "react";
import { OutfitCard } from "@/components/outfit-card";
import { TryonModal } from "@/components/tryon-modal";
import { FavoriteButton } from "@/components/favorite-button";
import { DownReason } from "@/components/down-reason";
import { Spinner } from "@/components/spinner";
import { LookRequest, type LookInput } from "@/components/weather-picker";
import { voteOutfit, markWorn } from "@/lib/outfit-actions";
import { notifyFirstLike } from "@/lib/pwa";
import { Icon } from "@/components/icon";
import { useTryon } from "@/lib/use-tryon";

export type HoyOutfit = {
  id: string;
  nombre: string;
  explicacion: string;
  tryon?: string | null;
  favorited?: boolean;
  prendas: { nombre: string; swatch: string; imagen?: string | null }[];
};

type State =
  | { kind: "ask" }
  | { kind: "generating"; phase: string }
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
  votoInicial,
  wornInicial,
  userId,
  defaultObjective,
}: {
  lookInicial: HoyOutfit | null;
  votoInicial: "up" | "down" | null;
  wornInicial: boolean;
  userId: string;
  defaultObjective: string | null;
}) {
  const [state, setState] = useState<State>(
    lookInicial ? { kind: "ready", outfit: lookInicial } : { kind: "ask" }
  );
  const [voto, setVoto] = useState(votoInicial);
  const [worn, setWorn] = useState(wornInicial);
  const lastInput = useRef<LookInput | null>(null);
  const pendingForce = useRef(false);

  const generar = useCallback(async (input: LookInput, force: boolean) => {
    lastInput.current = input;
    setState({ kind: "generating", phase: "preparando tu look…" });
    setVoto(null);
    setWorn(false);
    try {
      const res = await fetch("/api/look-of-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, force }),
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
          if (evt.phase) setState({ kind: "generating", phase: evt.phase });
          else if (evt.error) {
            setState({ kind: "error", code: evt.error });
            return;
          } else if (evt.done) {
            setState({ kind: "ready", outfit: evt.outfit });
            return;
          }
        }
      }
      setState({ kind: "error", code: "red" });
    } catch {
      setState({ kind: "error", code: "red" });
    }
  }, []);

  // Abre la pantalla de ocasión+clima y luego genera. Siempre la muestra (para
  // poder cambiar la ocasión cada vez). force = "Otro look".
  function startGen(force: boolean) {
    pendingForce.current = force;
    setState({ kind: "ask" });
  }

  async function vote(up: boolean) {
    if (state.kind !== "ready") return;
    const prev = voto;
    setVoto(up ? "up" : "down");
    const res = await voteOutfit(state.outfit.id, up);
    if (!res.ok) setVoto(prev);
    else if (up) notifyFirstLike(); // pico emocional → ofrecer instalar la PWA
  }

  async function meLoPuse() {
    if (state.kind !== "ready" || worn) return;
    setWorn(true);
    const res = await markWorn(state.outfit.id);
    if (!res.ok) setWorn(false);
  }

  if (state.kind === "ask") {
    return (
      <LookRequest
        title="Tu look de hoy"
        defaultObjective={defaultObjective}
        onPick={(input) => generar(input, pendingForce.current)}
      />
    );
  }

  if (state.kind === "generating") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <Spinner className="h-8 w-8 text-accent" />
        <p
          key={state.phase}
          className="editorial animate-[fadein_400ms_ease-out] text-lg text-ink"
        >
          {state.phase}
        </p>
        <style>{`@keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
        <p className="text-sm text-muted">Tu look de hoy está casi listo.</p>
      </div>
    );
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
      <h2 className="text-h3 font-semibold text-ink">{state.outfit.nombre}</h2>
      <TryonOutfitCard
        key={state.outfit.id}
        outfit={state.outfit}
        userId={userId}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => vote(true)}
          aria-pressed={voto === "up"}
          aria-label="Me gusta"
          className={`flex min-h-12 flex-1 items-center justify-center rounded-sm border text-sm font-medium transition-colors duration-200 ${
            voto === "up"
              ? "border-accent bg-accent-soft text-ink"
              : "border-line bg-surface text-ink hover:border-ink"
          }`}
        >
          <Icon name="pulgar" size={20} active={voto === "up"} />
        </button>
        <button
          type="button"
          onClick={() => vote(false)}
          aria-pressed={voto === "down"}
          aria-label="No me gusta"
          className={`flex min-h-12 flex-1 items-center justify-center rounded-sm border text-sm font-medium transition-colors duration-200 ${
            voto === "down"
              ? "border-accent bg-accent-soft text-ink"
              : "border-line bg-surface text-ink hover:border-ink"
          }`}
        >
          <Icon name="pulgar" size={20} rotate={180} active={voto === "down"} />
        </button>
        <button
          type="button"
          onClick={() => startGen(true)}
          className="flex min-h-12 flex-1 items-center justify-center rounded-sm border border-line bg-surface text-sm font-medium text-ink transition-colors duration-200 hover:border-ink"
        >
          Otro look
        </button>
      </div>
      {voto === "down" ? <DownReason outfitId={state.outfit.id} /> : null}
      <button
        type="button"
        onClick={meLoPuse}
        disabled={worn}
        className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-sm text-base font-medium transition-colors duration-200 ${
          worn
            ? "bg-success/15 text-success"
            : "bg-accent text-on-accent hover:bg-accent-deep"
        }`}
      >
        {worn ? (
          <>
            <Icon name="check" size={18} /> Me lo puse hoy
          </>
        ) : (
          "Me lo puse"
        )}
      </button>
    </div>
  );
}

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
  });

  return (
    <>
      <OutfitCard
        prendas={outfit.prendas.map((p) => ({ ...p, detalle: "" }))}
        justificacion={outfit.explicacion}
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
          onChangePhoto: t.pickPhoto,
        }}
      />
      {t.image ? (
        <button
          type="button"
          onClick={t.pickPhoto}
          className="self-start text-xs font-medium text-muted underline underline-offset-4 hover:text-ink"
        >
          ¿No te pareces? Cambia tu foto
        </button>
      ) : null}
      {t.fileInput}
      {t.mode === "full" && t.image ? (
        <TryonModal
          image={t.image}
          lookName={outfit.nombre}
          onClose={t.closeFull}
          onChangePhoto={t.pickPhoto}
        />
      ) : null}
    </>
  );
}
