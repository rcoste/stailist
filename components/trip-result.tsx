"use client";

import { useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/icon";
import { setTripPacked } from "@/lib/trip-actions";

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

// Estado efectivo (base + decisión guardada de un "parecido").
function eff(r: TripRow): TripRow["base"] {
  if (r.base === "parecido") {
    return r.decision === "accept" ? "tienes" : r.decision === "reject" ? "falta" : "parecido";
  }
  return r.base;
}

// Tab "La maleta" (handoff): barra de progreso + grid de "empaca esto" con check
// tappable + "te falta" con "ya lo tengo". Un faltante marcado como "ya lo tengo"
// pasa a empaca palomeado (persiste en empacado, sin acción nueva).
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
  const isPacked = (i: number) => !!packed[String(i)];

  // Empaca: lo que tienes/parecido + cualquier faltante ya marcado "ya lo tengo".
  // Te falta: lo que falta y aún no marcas.
  const empaca = rows.filter((r) => eff(r) !== "falta" || isPacked(r.index));
  const falta = rows.filter((r) => eff(r) === "falta" && !isPacked(r.index));
  const packedCount = empaca.filter((r) => isPacked(r.index)).length;

  function togglePacked(index: number, value?: boolean) {
    const next = value ?? !isPacked(index);
    setPacked((p) => ({ ...p, [String(index)]: next }));
    setTripPacked(tripId, index, next);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Progreso de empacado */}
      <div className="flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-success"
            style={{ width: `${empaca.length ? (packedCount / empaca.length) * 100 : 0}%` }}
          />
        </div>
        <span className="tabular whitespace-nowrap text-xs font-semibold text-ink">
          {packedCount} / {empaca.length} empacadas
        </span>
      </div>

      {empaca.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">
              Empaca esto
            </span>
            <span className="tabular text-[11px] text-muted">{empaca.length}</span>
          </div>
          <ul className="grid grid-cols-4 gap-2">
            {empaca.map((r) => {
              const on = isPacked(r.index);
              return (
                <li key={r.index}>
                  <button
                    type="button"
                    onClick={() => togglePacked(r.index)}
                    title={r.by ?? r.nombre}
                    className="block w-full"
                  >
                    <span className="relative block aspect-[3/4] overflow-hidden rounded-md border border-line bg-surface">
                      {r.byImage ? (
                        <Image
                          src={r.byImage}
                          alt={r.by ?? r.nombre}
                          fill
                          sizes="(max-width:430px) 25vw, 100px"
                          className={`object-cover ${on ? "" : "opacity-[0.62]"}`}
                        />
                      ) : (
                        <span
                          className={`flex h-full w-full items-center justify-center text-muted ${
                            on ? "" : "opacity-[0.62]"
                          }`}
                        >
                          <Icon name="gancho" size={20} />
                        </span>
                      )}
                      <span
                        className={`absolute right-1 top-1 flex h-[19px] w-[19px] items-center justify-center rounded-full ${
                          on ? "bg-success text-on-accent" : "border-[1.5px] border-line bg-bg/85"
                        }`}
                      >
                        {on ? <Icon name="check" size={12} strokeWidth={2.4} /> : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {falta.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">
              Te falta
            </span>
            <span className="tabular text-[11px] text-muted">{falta.length}</span>
          </div>
          <ul className="flex flex-col gap-2.5">
            {falta.map((r) => (
              <li
                key={r.index}
                className="flex items-center gap-2.5 rounded-md border border-dashed border-accent/40 bg-accent-soft px-[13px] py-[11px]"
              >
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-sm border border-accent/30 bg-surface text-accent">
                  <Icon name="mas" size={16} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="text-[13px] font-semibold leading-tight text-ink">{r.nombre}</b>
                  <span className="text-[11.5px] leading-snug text-muted">{r.porque}</span>
                </span>
                <button
                  type="button"
                  onClick={() => togglePacked(r.index, true)}
                  className="flex shrink-0 items-center gap-1.5 rounded-sm border border-accent bg-accent-soft px-[11px] py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft/60"
                >
                  <Icon name="check" size={13} /> Ya lo tengo
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
