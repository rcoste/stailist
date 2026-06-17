"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { OutfitCard } from "@/components/outfit-card";
import { TryonButton } from "@/components/tryon-button";
import { FavoriteButton } from "@/components/favorite-button";
import { DownReason } from "@/components/down-reason";
import { Spinner } from "@/components/spinner";
import { LookRequest, type LookInput } from "@/components/weather-picker";
import { voteOutfit } from "@/lib/outfit-actions";
import { notifyFirstLike } from "@/lib/pwa";
import { Icon } from "@/components/icon";

export type WowOutfit = {
  id: string;
  nombre: string;
  explicacion: string;
  tryon?: string | null;
  prendas: { nombre: string; swatch: string; imagen?: string | null }[];
};

type State =
  | { kind: "ask" }
  | { kind: "generating"; phase: string }
  | { kind: "streaming"; outfits: WowOutfit[]; total: number; phase: string }
  | { kind: "ready"; outfits: WowOutfit[] }
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

export function WowClient({
  initialOutfits,
  userId,
  defaultObjective,
}: {
  initialOutfits: WowOutfit[] | null;
  userId: string;
  defaultObjective: string | null;
}) {
  const [state, setState] = useState<State>(
    initialOutfits ? { kind: "ready", outfits: initialOutfits } : { kind: "ask" }
  );
  const [votes, setVotes] = useState<Record<string, "up" | "down">>({});
  const lastInput = useRef<LookInput | null>(null);

  const generate = useCallback(async (input: LookInput) => {
    lastInput.current = input;
    setState({ kind: "generating", phase: "preparando al stylist…" });
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
          if (typeof evt.total === "number") {
            setState({
              kind: "streaming",
              outfits: [],
              total: evt.total,
              phase: "afinando el styling…",
            });
          } else if (evt.outfit) {
            setState((s) =>
              s.kind === "streaming"
                ? { ...s, outfits: [...s.outfits, evt.outfit as WowOutfit] }
                : s
            );
          } else if (evt.phase) {
            setState((s) =>
              s.kind === "streaming"
                ? { ...s, phase: evt.phase }
                : { kind: "generating", phase: evt.phase }
            );
          } else if (evt.error) {
            setState({ kind: "error", code: evt.error });
            return;
          } else if (evt.done) {
            setState((s) => ({
              kind: "ready",
              outfits: s.kind === "streaming" || s.kind === "ready" ? s.outfits : [],
            }));
            return;
          }
        }
      }
      setState((s) =>
        s.kind === "streaming" && s.outfits.length > 0
          ? { kind: "ready", outfits: s.outfits }
          : { kind: "error", code: "red" }
      );
    } catch {
      setState({ kind: "error", code: "red" });
    }
  }, []);

  async function vote(outfitId: string, up: boolean) {
    setVotes((v) => ({ ...v, [outfitId]: up ? "up" : "down" }));
    const res = await voteOutfit(outfitId, up);
    if (!res.ok) {
      setVotes((v) => {
        const next = { ...v };
        delete next[outfitId];
        return next;
      });
    } else if (up) {
      notifyFirstLike(); // pico emocional → ofrecer instalar la PWA
    }
  }

  function outfitBlock(outfit: WowOutfit) {
    const v = votes[outfit.id];
    return (
      <div key={outfit.id} className="flex flex-col gap-3">
        <h2 className="text-h3 font-semibold text-ink">{outfit.nombre}</h2>
        <OutfitCard
          prendas={outfit.prendas.map((p) => ({ ...p, detalle: "" }))}
          justificacion={outfit.explicacion}
          corner={<FavoriteButton outfitId={outfit.id} initialFavorited={false} />}
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => vote(outfit.id, true)}
            aria-pressed={v === "up"}
            className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-sm border text-sm font-medium transition-colors duration-200 ${
              v === "up"
                ? "border-accent bg-accent-soft text-ink"
                : "border-line bg-surface text-ink hover:border-ink"
            }`}
          >
            <Icon name="pulgar" size={18} active={v === "up"} /> Me gusta
          </button>
          <button
            type="button"
            onClick={() => vote(outfit.id, false)}
            aria-pressed={v === "down"}
            className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-sm border text-sm font-medium transition-colors duration-200 ${
              v === "down"
                ? "border-accent bg-accent-soft text-ink"
                : "border-line bg-surface text-ink hover:border-ink"
            }`}
          >
            <Icon name="pulgar" size={18} rotate={180} active={v === "down"} /> No va
          </button>
        </div>
        {v === "down" ? <DownReason outfitId={outfit.id} /> : null}
        <TryonButton
          outfitId={outfit.id}
          userId={userId}
          initialImage={outfit.tryon ?? null}
        />
      </div>
    );
  }

  if (state.kind === "ask") {
    return (
      <LookRequest
        title="Antes de armar tu primer look…"
        defaultObjective={defaultObjective}
        onPick={generate}
      />
    );
  }

  if (state.kind === "generating") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
        <Spinner className="h-8 w-8 text-accent" />
        <p
          key={state.phase}
          className="editorial animate-[fadein_400ms_ease-out] text-lg text-ink"
        >
          {state.phase}
        </p>
        <style>{`@keyframes fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
        <p className="text-sm text-muted">Tu primer look está a unos segundos.</p>
      </div>
    );
  }

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

  // streaming | ready
  const outfits = state.outfits;
  const pending =
    state.kind === "streaming" ? Math.max(0, state.total - outfits.length) : 0;

  return (
    <div className="flex flex-col gap-6 pb-8">
      {outfits.map(outfitBlock)}

      {Array.from({ length: pending }).map((_, i) => (
        <div
          key={`pending-${i}`}
          className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line bg-surface py-16 text-center"
        >
          <Spinner className="h-6 w-6 text-accent" />
          <p className="text-sm text-muted">
            {state.kind === "streaming" ? state.phase : "armando el siguiente…"}
          </p>
        </div>
      ))}

      {state.kind === "ready" && (
        <Link
          href="/hoy"
          className="flex min-h-12 items-center justify-center rounded-sm bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
        >
          Listo, llévame a mi día
        </Link>
      )}
    </div>
  );
}
