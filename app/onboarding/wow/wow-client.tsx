"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { OutfitCard } from "@/components/outfit-card";
import { voteOutfit } from "./actions";

export type WowOutfit = {
  id: string;
  nombre: string;
  explicacion: string;
  prendas: { nombre: string; swatch: string }[];
};

type State =
  | { kind: "generating"; phase: string }
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

// Pide ubicación con timeout corto; si la niega o tarda, generamos sin clima.
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

export function WowClient({
  initialOutfits,
}: {
  initialOutfits: WowOutfit[] | null;
}) {
  const [state, setState] = useState<State>(
    initialOutfits
      ? { kind: "ready", outfits: initialOutfits }
      : { kind: "generating", phase: "preparando al stylist…" }
  );
  const [votes, setVotes] = useState<Record<string, "up" | "down">>({});
  const started = useRef(false);

  const generate = useCallback(async () => {
    setState({ kind: "generating", phase: "preparando al stylist…" });
    try {
      const coords = await getPosition();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coords ?? {}),
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
          if (evt.phase) {
            setState({ kind: "generating", phase: evt.phase });
          } else if (evt.error) {
            setState({ kind: "error", code: evt.error });
            return;
          } else if (evt.done) {
            setState({ kind: "ready", outfits: evt.outfits });
            return;
          }
        }
      }
      setState({ kind: "error", code: "red" });
    } catch {
      setState({ kind: "error", code: "red" });
    }
  }, []);

  useEffect(() => {
    if (initialOutfits) return; // ya hay looks guardados: no quemar otra generación
    if (started.current) return; // doble mount de dev/StrictMode: una sola generación
    started.current = true;
    generate();
  }, [generate, initialOutfits]);

  async function vote(outfitId: string, up: boolean) {
    setVotes((v) => ({ ...v, [outfitId]: up ? "up" : "down" }));
    const res = await voteOutfit(outfitId, up);
    if (!res.ok) {
      setVotes((v) => {
        const next = { ...v };
        delete next[outfitId];
        return next;
      });
    }
  }

  if (state.kind === "generating") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
        <p
          key={state.phase}
          className="editorial animate-[fadein_400ms_ease-out] text-lg text-ink"
        >
          {state.phase}
        </p>
        <style>{`@keyframes fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
        <p className="text-sm text-muted">
          Tu primer look está a unos segundos.
        </p>
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
            onClick={generate}
            className="min-h-12 rounded-full bg-accent px-8 text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      {state.outfits.map((outfit) => {
        const v = votes[outfit.id];
        return (
          <div key={outfit.id} className="flex flex-col gap-3">
            <h2 className="text-h3 font-semibold text-ink">{outfit.nombre}</h2>
            <OutfitCard
              prendas={outfit.prendas.map((p) => ({ ...p, detalle: "" }))}
              justificacion={outfit.explicacion}
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => vote(outfit.id, true)}
                aria-pressed={v === "up"}
                className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border text-sm font-medium transition-colors duration-200 ${
                  v === "up"
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-line bg-surface text-ink hover:border-ink"
                }`}
              >
                👍 Me gusta
              </button>
              <button
                type="button"
                onClick={() => vote(outfit.id, false)}
                aria-pressed={v === "down"}
                className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border text-sm font-medium transition-colors duration-200 ${
                  v === "down"
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-line bg-surface text-ink hover:border-ink"
                }`}
              >
                👎 No va
              </button>
            </div>
          </div>
        );
      })}

      <Link
        href="/hoy"
        className="flex min-h-12 items-center justify-center rounded-full bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
      >
        Listo, llévame a mi día
      </Link>
    </div>
  );
}
