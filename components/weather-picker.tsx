"use client";

import { useState } from "react";
import { Spinner } from "@/components/spinner";

// El motor arma el outfit según el clima. En vez de disparar el popup nativo de
// ubicación en frío, explicamos y damos dos caminos: usar ubicación (clima real
// vía Open-Meteo) o decir cómo está el día con referencias fáciles (no solo
// "frío/calor"). Si la ubicación falla, caen los buckets.

export type WeatherInput =
  | { lat: number; lon: number }
  | { weather: { temp_c: number; condition: string } };

// Buckets de temperatura con una referencia tangible. temp_c es un valor
// representativo que se le pasa al motor.
const BUCKETS = [
  { emoji: "🥶", label: "Helado", ref: "para abrigo grueso", temp_c: 5 },
  { emoji: "🧥", label: "Frío", ref: "suéter o chamarra", temp_c: 12 },
  { emoji: "🌤️", label: "Templado", ref: "manga larga ligera", temp_c: 19 },
  { emoji: "☀️", label: "Cálido", ref: "playera, a gusto", temp_c: 25 },
  { emoji: "🔥", label: "Caluroso", ref: "lo más fresco posible", temp_c: 33 },
];

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

export function WeatherPicker({
  title,
  onPick,
}: {
  title: string;
  onPick: (input: WeatherInput) => void;
}) {
  const [locating, setLocating] = useState(false);
  const [locFailed, setLocFailed] = useState(false);
  const [rain, setRain] = useState(false);

  async function useLocation() {
    setLocating(true);
    setLocFailed(false);
    const coords = await getPosition();
    setLocating(false);
    if (coords) onPick(coords);
    else setLocFailed(true);
  }

  function pickBucket(temp_c: number) {
    onPick({ weather: { temp_c, condition: rain ? "lluvia" : "despejado" } });
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-5 py-10">
      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-h3 font-semibold text-ink">{title}</h2>
        <p className="text-sm text-muted">
          Lo uso para acertarle a tu look — no vaya a sugerirte un abrigo en
          pleno calor. 🌤️
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
  );
}
