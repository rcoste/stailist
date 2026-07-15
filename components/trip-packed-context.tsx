"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Estado de empacado del viaje COMPARTIDO entre el tab de la maleta (los checks)
// y el rail de desktop (la barra "EMPACADO x de y") — cruzan la frontera RSC de
// la página, así que viven en un context (mismo patrón que trip-gen-context).
// La persistencia (setTripPacked) la sigue disparando quien palomea; aquí solo
// vive el estado optimista.
type Ctx = {
  packed: Record<string, boolean>;
  setPackedFor: (index: number, value: boolean) => void;
};

const TripPackedContext = createContext<Ctx | null>(null);

export function TripPackedProvider({
  initial,
  children,
}: {
  initial: Record<string, boolean>;
  children: ReactNode;
}) {
  const [packed, setPacked] = useState<Record<string, boolean>>(initial);
  const setPackedFor = (index: number, value: boolean) =>
    setPacked((p) => ({ ...p, [String(index)]: value }));
  return (
    <TripPackedContext.Provider value={{ packed, setPackedFor }}>
      {children}
    </TripPackedContext.Provider>
  );
}

export function useTripPacked(): Ctx {
  const ctx = useContext(TripPackedContext);
  if (!ctx) throw new Error("useTripPacked fuera de TripPackedProvider");
  return ctx;
}

// Barra de progreso del rail (desktop): "EMPACADO x de y". Los índices de lo
// empacable vienen del server; el estado vivo del context.
export function TripPackedBar({ empacaIndices }: { empacaIndices: number[] }) {
  const { packed } = useTripPacked();
  const done = empacaIndices.filter((i) => packed[String(i)]).length;
  const total = empacaIndices.length;
  if (total === 0) return null;
  return (
    <div className="hidden flex-col gap-2.5 border-t border-line pt-4 lg:flex">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted">
          Empacado
        </span>
        <span className="tabular text-xs font-semibold text-ink">
          {done} de {total}
        </span>
      </div>
      <div className="h-[3px] overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-ink transition-[width] duration-300"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>
    </div>
  );
}
