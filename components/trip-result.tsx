"use client";

import { useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/icon";
import { setTripOverride, setTripPacked } from "@/lib/trip-actions";

// Una prenda de la cápsula del viaje, ya resuelta contra el clóset (vista plana
// que arma la página servidor a partir de capsuleRows + el mapa de imágenes).
export type TripRow = {
  index: number;
  nombre: string; // prenda ideal
  porque: string;
  base: "tienes" | "parecido" | "falta" | "pendiente"; // lo que dijo el match
  decision: "accept" | "reject" | null; // decisión guardada (solo en "parecido")
  by: string | null; // prenda del clóset que la cubre / se le parece
  byImage: string | null;
};

function Thumb({ src }: { src: string | null }) {
  return (
    <span className="relative flex h-12 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-bg text-muted">
      {src ? (
        <Image src={src} alt="" fill sizes="40px" className="object-cover" />
      ) : (
        <Icon name="gancho" size={16} />
      )}
    </span>
  );
}

export function TripResult({
  tripId,
  rows,
  empacado: empacadoInicial,
}: {
  tripId: string;
  rows: TripRow[];
  empacado: Record<string, boolean>;
}) {
  const [packed, setPacked] = useState<Record<string, boolean>>(empacadoInicial);
  const [decisions, setDecisions] = useState<Record<number, "accept" | "reject" | null>>(
    Object.fromEntries(rows.map((r) => [r.index, r.decision]))
  );

  // Estado efectivo: base + la decisión local (optimista).
  function eff(r: TripRow): TripRow["base"] {
    if (r.base === "parecido") {
      const d = decisions[r.index];
      return d === "accept" ? "tienes" : d === "reject" ? "falta" : "parecido";
    }
    return r.base;
  }

  const empaca = rows.filter((r) => {
    const e = eff(r);
    return e === "tienes" || e === "pendiente";
  });
  const casi = rows.filter((r) => eff(r) === "parecido");
  const falta = rows.filter((r) => eff(r) === "falta");

  function togglePacked(index: number) {
    const next = !packed[String(index)];
    setPacked((p) => ({ ...p, [String(index)]: next }));
    setTripPacked(tripId, index, next);
  }

  function decide(index: number, decision: "accept" | "reject") {
    setDecisions((d) => ({ ...d, [index]: d[index] === decision ? null : decision }));
    setTripOverride(tripId, index, decision);
  }

  return (
    <div className="flex flex-col gap-6">
      {empaca.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Empaca esto · {empaca.length}
          </span>
          <div className="flex flex-col gap-2">
            {empaca.map((r) => {
              const on = !!packed[String(r.index)];
              return (
                <button
                  key={r.index}
                  type="button"
                  onClick={() => togglePacked(r.index)}
                  className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-ink"
                >
                  <Thumb src={r.byImage} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={`text-sm font-medium ${
                        on ? "text-muted line-through" : "text-ink"
                      }`}
                    >
                      {r.by ?? r.nombre}
                    </span>
                    <span className="truncate text-xs text-muted">{r.porque}</span>
                  </span>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      on
                        ? "border-accent bg-accent text-on-accent"
                        : "border-line bg-bg text-muted"
                    }`}
                  >
                    {on ? <Icon name="check" size={14} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {casi.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Tienes algo parecido
          </span>
          <div className="flex flex-col gap-2">
            {casi.map((r) => (
              <div
                key={r.index}
                className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3"
              >
                <div className="flex items-center gap-3">
                  <Thumb src={r.byImage} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium text-ink">{r.nombre}</span>
                    <span className="truncate text-xs text-muted">
                      Tienes: {r.by} — ¿te sirve?
                    </span>
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => decide(r.index, "accept")}
                    className="min-h-9 flex-1 rounded-sm border border-line bg-bg text-sm font-medium text-ink transition-colors hover:border-accent"
                  >
                    Sí, me sirve
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(r.index, "reject")}
                    className="min-h-9 flex-1 rounded-sm border border-line bg-bg text-sm font-medium text-muted transition-colors hover:border-accent"
                  >
                    No, mejor la llevo
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {falta.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Te falta · {falta.length}
          </span>
          <div className="flex flex-col gap-2">
            {falta.map((r) => (
              <div
                key={r.index}
                className="flex items-center gap-3 rounded-lg border border-dashed border-line bg-bg p-3"
              >
                <span className="flex h-12 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-line text-muted">
                  <Icon name="mas" size={16} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-ink">{r.nombre}</span>
                  <span className="truncate text-xs text-muted">{r.porque}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
