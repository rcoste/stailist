"use client";

import { useState } from "react";
import { Spinner } from "@/components/spinner";
import { Icon, type IconName } from "@/components/icon";
import { OBJECTIVES, type Objective } from "@/app/onboarding/objetivo/objectives";

// Compositor (rebrand v2): ocasión (cards con ícono) + plan de texto libre
// opcional + clima (ubicación o termómetro de 5 puntos) → arma el look. El
// "plan" viaja al motor para afinar el look a lo que la usuaria tiene en mente.

export type LookInput = { objective: string; plan?: string } & (
  | { lat: number; lon: number }
  | { weather: { temp_c: number; condition: string } }
);

const OBJ_ICON: Record<Objective, IconName> = {
  diario: "sol",
  oficina: "maletin",
  evento: "destello",
  viaje: "avion",
  refrescar: "repetir",
};

const BUCKETS = [
  { label: "Helado", ref: "para abrigo grueso", temp_c: 5 },
  { label: "Frío", ref: "suéter o chamarra", temp_c: 12 },
  { label: "Templado", ref: "manga larga ligera", temp_c: 19 },
  { label: "Cálido", ref: "playera, a gusto", temp_c: 25 },
  { label: "Caluroso", ref: "lo más fresco posible", temp_c: 33 },
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
    defaultObjective && defaultObjective in OBJECTIVES ? defaultObjective : "diario"
  );
  const [plan, setPlan] = useState("");
  const [climaIdx, setClimaIdx] = useState<number | null>(null);
  const [rain, setRain] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locFailed, setLocFailed] = useState(false);

  const planOpt = plan.trim() ? { plan: plan.trim() } : {};

  async function useLocation() {
    setLocating(true);
    setLocFailed(false);
    const coords = await getPosition();
    setLocating(false);
    if (coords) onPick({ objective, ...planOpt, ...coords });
    else setLocFailed(true);
  }

  function armar() {
    if (climaIdx === null) return;
    const b = BUCKETS[climaIdx];
    onPick({
      objective,
      ...planOpt,
      weather: { temp_c: b.temp_c, condition: rain ? "lluvia" : "despejado" },
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pt-2 pb-6">
      <h2 className="text-h2 font-semibold text-ink">{title}</h2>

      {/* Ocasión */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">¿A dónde vas hoy?</p>
        <div className="grid grid-cols-2 gap-2">
          {OBJECTIVE_LIST.map((o, i) => {
            const on = objective === o.key;
            const full = i === OBJECTIVE_LIST.length - 1;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setObjective(o.key)}
                aria-pressed={on}
                className={`flex min-h-12 items-center gap-2 rounded-sm border px-4 text-sm font-medium transition-colors duration-200 ${
                  full ? "col-span-2" : ""
                } ${
                  on
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-line bg-surface text-ink hover:border-ink"
                }`}
              >
                <Icon name={OBJ_ICON[o.key as Objective]} size={18} active={on} />
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Plan libre */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">
          ¿Algo en mente? <span className="font-normal text-muted">(opcional)</span>
        </p>
        <input
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          maxLength={200}
          placeholder="ej. cena con amigos en una terraza"
          className="min-h-12 rounded-sm border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      {/* Clima */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-ink">¿Qué clima?</p>

        <button
          type="button"
          onClick={useLocation}
          disabled={locating}
          className="flex min-h-12 items-center justify-center gap-2 rounded-sm border border-line bg-surface text-sm font-medium text-ink transition-colors duration-200 hover:border-ink disabled:opacity-60"
        >
          {locating ? (
            <>
              <Spinner className="h-4 w-4" /> Leyendo el clima…
            </>
          ) : (
            <>
              <Icon name="ubicacion" size={18} /> Usar mi ubicación
            </>
          )}
        </button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs text-muted">
            {locFailed ? "no pude leerla — dime tú" : "o ajústalo a mano"}
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {/* Termómetro de 5 puntos: copo (frío) → sol (calor) */}
        <div className="flex items-center gap-3">
          <Icon name="copo" size={18} className="shrink-0 text-muted" />
          <div className="flex flex-1 items-center justify-between">
            {BUCKETS.map((b, i) => {
              const filled = climaIdx !== null && i <= climaIdx;
              return (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => setClimaIdx(i)}
                  aria-label={b.label}
                  aria-pressed={climaIdx === i}
                  className="flex flex-1 items-center justify-center py-2"
                >
                  <span
                    className={`h-4 w-4 rounded-full border transition-colors duration-200 ${
                      filled
                        ? "border-accent bg-accent"
                        : "border-line bg-surface"
                    }`}
                  />
                </button>
              );
            })}
          </div>
          <Icon name="sol" size={18} className="shrink-0 text-muted" />
        </div>
        <p className="text-center text-sm text-ink">
          {climaIdx !== null
            ? `${BUCKETS[climaIdx].label} · ${BUCKETS[climaIdx].ref}`
            : "Toca para marcar el clima"}
        </p>

        {/* ¿Va a llover? — segmentado */}
        <div className="flex items-center justify-center gap-3 text-sm">
          <span className="text-muted">¿Va a llover?</span>
          <div className="inline-flex overflow-hidden rounded-sm border border-line">
            <button
              type="button"
              onClick={() => setRain(false)}
              className={`min-h-9 px-5 text-sm font-medium transition-colors duration-200 ${
                !rain ? "bg-accent-soft text-accent" : "bg-surface text-ink"
              }`}
            >
              No
            </button>
            <button
              type="button"
              onClick={() => setRain(true)}
              className={`min-h-9 border-l border-line px-5 text-sm font-medium transition-colors duration-200 ${
                rain ? "bg-accent-soft text-accent" : "bg-surface text-ink"
              }`}
            >
              Sí
            </button>
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={armar}
        disabled={climaIdx === null}
        className="flex min-h-12 w-full items-center justify-center rounded-sm bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
      >
        Armar mi look
      </button>
    </div>
  );
}
