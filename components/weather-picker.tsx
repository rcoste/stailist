"use client";

import { useState } from "react";
import { Spinner } from "@/components/spinner";
import { OBJECTIVES, type Objective } from "@/app/onboarding/objetivo/objectives";

// Antes de armar un look capturamos DOS cosas: la ocasión (cambiable cada vez,
// no solo en el onboarding) y el clima. El clima puede ser tu ubicación actual
// o manual con referencias — así puedes planear para otro lugar/día (ej. un
// viaje) sin que tome tu ventana actual.

export type LookInput = { objective: string } & (
  | { lat: number; lon: number }
  | { weather: { temp_c: number; condition: string } }
);

const BUCKETS = [
  { emoji: "🥶", label: "Helado", ref: "para abrigo grueso", temp_c: 5 },
  { emoji: "🧥", label: "Frío", ref: "suéter o chamarra", temp_c: 12 },
  { emoji: "🌤️", label: "Templado", ref: "manga larga ligera", temp_c: 19 },
  { emoji: "☀️", label: "Cálido", ref: "playera, a gusto", temp_c: 25 },
  { emoji: "🔥", label: "Caluroso", ref: "lo más fresco posible", temp_c: 33 },
];

const OBJECTIVE_LIST = (Object.entries(OBJECTIVES) as [Objective, string][]).map(
  ([key, label]) => ({ key, label })
);

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
  title,
  defaultObjective,
  onPick,
}: {
  title: string;
  defaultObjective: string | null;
  onPick: (input: LookInput) => void;
}) {
  const [objective, setObjective] = useState<string>(
    defaultObjective && defaultObjective in OBJECTIVES
      ? defaultObjective
      : "diario"
  );
  const [locating, setLocating] = useState(false);
  const [locFailed, setLocFailed] = useState(false);
  const [rain, setRain] = useState(false);

  async function useLocation() {
    setLocating(true);
    setLocFailed(false);
    const coords = await getPosition();
    setLocating(false);
    if (coords) onPick({ objective, ...coords });
    else setLocFailed(true);
  }

  function pickBucket(temp_c: number) {
    onPick({
      objective,
      weather: { temp_c, condition: rain ? "lluvia" : "despejado" },
    });
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-6 py-8">
      <h2 className="text-center text-h3 font-semibold text-ink">{title}</h2>

      {/* Ocasión */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">¿Para qué ocasión?</p>
        <div className="flex flex-wrap gap-2">
          {OBJECTIVE_LIST.map((o) => {
            const on = objective === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setObjective(o.key)}
                aria-pressed={on}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
                  on
                    ? "border-accent bg-accent text-on-accent"
                    : "border-line bg-surface text-ink hover:border-ink"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Clima */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-ink">¿Cómo está el clima?</p>
          <p className="text-xs text-muted">
            Para acertarle al look. Si planeas para otro lugar o día, dímelo
            manual. 🌤️
          </p>
        </div>

        <button
          type="button"
          onClick={useLocation}
          disabled={locating}
          className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-60"
        >
          {locating ? (
            <>
              <Spinner className="h-4 w-4" /> Leyendo el clima…
            </>
          ) : (
            "📍 Usar mi ubicación"
          )}
        </button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs text-muted">
            {locFailed ? "no pude leerla — dime tú" : "o dime cómo está"}
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="flex flex-col gap-2">
          {BUCKETS.map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => pickBucket(b.temp_c)}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left transition-colors duration-200 hover:border-accent"
            >
              <span className="text-2xl" aria-hidden>
                {b.emoji}
              </span>
              <span className="flex flex-col">
                <span className="text-base font-medium text-ink">{b.label}</span>
                <span className="text-sm text-muted">{b.ref}</span>
              </span>
            </button>
          ))}
        </div>

        <label className="flex items-center justify-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={rain}
            onChange={(e) => setRain(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Está lloviendo 🌧️
        </label>
      </div>
    </div>
  );
}
