"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/spinner";
import { OCCASIONS, LUGGAGE, type Occasion, type Luggage } from "@/lib/trip";

// Formulario de Modo viaje: lugar + fechas + ocasiones + tamaño de maleta →
// POST /api/trip (streaming con fases) → navega al resultado /viaje/[id].
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function TripForm() {
  const router = useRouter();
  const [lugar, setLugar] = useState("");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [ocasiones, setOcasiones] = useState<Set<Occasion>>(new Set());
  const [maleta, setMaleta] = useState<Luggage | null>(null);
  const [state, setState] = useState<
    { kind: "form" } | { kind: "gen"; phase: string } | { kind: "error" }
  >({ kind: "form" });

  const min = todayStr();
  const canGo =
    lugar.trim().length > 1 && inicio !== "" && fin !== "" && fin >= inicio && maleta !== null;

  function toggleOcc(o: Occasion) {
    setOcasiones((prev) => {
      const next = new Set(prev);
      if (next.has(o)) next.delete(o);
      else next.add(o);
      return next;
    });
  }

  async function generar() {
    if (!canGo) return;
    setState({ kind: "gen", phase: "preparando tu viaje…" });
    try {
      const res = await fetch("/api/trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lugar: lugar.trim(),
          fechaInicio: inicio,
          fechaFin: fin,
          ocasiones: [...ocasiones],
          maleta,
        }),
      });
      if (!res.ok || !res.body) {
        setState({ kind: "error" });
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
          if (evt.phase) setState({ kind: "gen", phase: evt.phase });
          else if (evt.error) {
            setState({ kind: "error" });
            return;
          } else if (evt.done) {
            router.push(`/viaje/${evt.tripId}`);
            return;
          }
        }
      }
      setState({ kind: "error" });
    } catch {
      setState({ kind: "error" });
    }
  }

  if (state.kind === "gen") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <Spinner className="h-8 w-8 text-accent" />
        <p className="editorial text-lg text-ink">{state.phase}</p>
        <p className="text-sm text-muted">Armando tu maleta — tarda unos segundos.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-2 pb-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">¿A dónde vas?</p>
        <input
          value={lugar}
          onChange={(e) => setLugar(e.target.value)}
          placeholder="ej. Los Ángeles"
          className="min-h-12 rounded-sm border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">¿Qué días?</p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={inicio}
            min={min}
            onChange={(e) => {
              setInicio(e.target.value);
              if (fin && fin < e.target.value) setFin(e.target.value);
            }}
            className="min-h-12 flex-1 rounded-sm border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none"
          />
          <span className="text-sm text-muted">a</span>
          <input
            type="date"
            value={fin}
            min={inicio || min}
            onChange={(e) => setFin(e.target.value)}
            className="min-h-12 flex-1 rounded-sm border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">¿Qué vas a hacer?</p>
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((o) => {
            const on = ocasiones.has(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggleOcc(o.value)}
                aria-pressed={on}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
                  on
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-surface text-muted hover:border-ink hover:text-ink"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">¿Qué maleta llevas?</p>
        <div className="grid grid-cols-3 gap-2">
          {LUGGAGE.map((l) => {
            const on = maleta === l.value;
            return (
              <button
                key={l.value}
                type="button"
                onClick={() => setMaleta(l.value)}
                aria-pressed={on}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-lg border px-2 text-center transition-colors duration-200 ${
                  on
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface hover:border-ink"
                }`}
              >
                <span className={`text-xs font-medium ${on ? "text-accent" : "text-ink"}`}>
                  {l.label}
                </span>
                <span className="text-[11px] text-muted">{l.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {state.kind === "error" ? (
        <p className="text-center text-sm text-error">
          No pude armar tu maleta — inténtalo de nuevo.
        </p>
      ) : null}

      <button
        type="button"
        disabled={!canGo}
        onClick={generar}
        className="flex min-h-12 items-center justify-center rounded-sm bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
      >
        Armar mi maleta
      </button>
    </div>
  );
}
