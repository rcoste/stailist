"use client";

import { useCallback, useRef, useState } from "react";
import { OutfitCard } from "@/components/outfit-card";
import { TryonButton } from "@/components/tryon-button";
import { Spinner } from "@/components/spinner";
import { WeatherPicker, type WeatherInput } from "@/components/weather-picker";
import { voteOutfit, markWorn } from "@/lib/outfit-actions";

export type HoyOutfit = {
  id: string;
  nombre: string;
  explicacion: string;
  tryon?: string | null;
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
}: {
  lookInicial: HoyOutfit | null;
  votoInicial: "up" | "down" | null;
  wornInicial: boolean;
  userId: string;
}) {
  const [state, setState] = useState<State>(
    lookInicial ? { kind: "ready", outfit: lookInicial } : { kind: "ask" }
  );
  const [voto, setVoto] = useState(votoInicial);
  const [worn, setWorn] = useState(wornInicial);
  const lastInput = useRef<WeatherInput | null>(null);
  const pendingForce = useRef(false);

  const generar = useCallback(async (input: WeatherInput, force: boolean) => {
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

  // Pide clima (ubicación o manual) y luego genera. force = "Otro look".
  function startGen(force: boolean) {
    pendingForce.current = force;
    if (lastInput.current) generar(lastInput.current, force);
    else setState({ kind: "ask" });
  }

  async function vote(up: boolean) {
    if (state.kind !== "ready") return;
    const prev = voto;
    setVoto(up ? "up" : "down");
    const res = await voteOutfit(state.outfit.id, up);
    if (!res.ok) setVoto(prev);
  }

  async function meLoPuse() {
    if (state.kind !== "ready" || worn) return;
    setWorn(true);
    const res = await markWorn(state.outfit.id);
    if (!res.ok) setWorn(false);
  }

  if (state.kind === "ask") {
    return (
      <WeatherPicker
        title="Tu look de hoy"
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
            className="min-h-12 rounded-full bg-accent px-8 text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
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
      <OutfitCard
        prendas={state.outfit.prendas.map((p) => ({ ...p, detalle: "" }))}
        justificacion={state.outfit.explicacion}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => vote(true)}
          aria-pressed={voto === "up"}
          aria-label="Me gusta"
          className={`flex min-h-12 flex-1 items-center justify-center rounded-full border text-sm font-medium transition-colors duration-200 ${
            voto === "up"
              ? "border-accent bg-accent-soft text-ink"
              : "border-line bg-surface text-ink hover:border-ink"
          }`}
        >
          👍
        </button>
        <button
          type="button"
          onClick={() => vote(false)}
          aria-pressed={voto === "down"}
          aria-label="No me gusta"
          className={`flex min-h-12 flex-1 items-center justify-center rounded-full border text-sm font-medium transition-colors duration-200 ${
            voto === "down"
              ? "border-accent bg-accent-soft text-ink"
              : "border-line bg-surface text-ink hover:border-ink"
          }`}
        >
          👎
        </button>
        <button
          type="button"
          onClick={() => startGen(true)}
          className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-line bg-surface text-sm font-medium text-ink transition-colors duration-200 hover:border-ink"
        >
          Otro look
        </button>
      </div>
      <button
        type="button"
        onClick={meLoPuse}
        disabled={worn}
        className={`min-h-12 w-full rounded-full text-base font-medium transition-colors duration-200 ${
          worn
            ? "bg-success/15 text-success"
            : "bg-accent text-on-accent hover:bg-accent-deep"
        }`}
      >
        {worn ? "✓ Me lo puse hoy" : "Me lo puse"}
      </button>
      <TryonButton
        outfitId={state.outfit.id}
        userId={userId}
        initialImage={state.outfit.tryon ?? null}
      />
    </div>
  );
}
