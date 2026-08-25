"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import type { PrendaRevisar } from "@/lib/revisar-closet";
import { confirmar, quitar } from "./actions";

// Una prenda a la vez, la más usada primero.
//
// De una en una y no en rejilla: la pregunta es "¿esto está en tu clóset?" y
// contestarla bien pide mirar la prenda, no barrer una cuadrícula. Con 40 por
// revisar, una rejilla se contesta en diagonal y no sirve de nada.

export function RevisarClient({ prendas }: { prendas: PrendaRevisar[] }) {
  const [i, setI] = useState(0);
  const [hechas, setHechas] = useState<{ id: string; quitada: boolean }[]>([]);
  const [pendiente, empezar] = useTransition();

  const p = prendas[i];
  const quitadas = hechas.filter((h) => h.quitada).length;

  const decidir = (existe: boolean) => {
    if (!p) return;
    empezar(async () => {
      const r = existe ? await confirmar(p.id) : await quitar(p.id);
      if ("error" in r) return;
      setHechas((h) => [...h, { id: p.id, quitada: !existe }]);
      setI((x) => x + 1);
    });
  };

  if (!p) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
        <h1 className="text-lg font-semibold text-ink">Listo</h1>
        <p className="text-sm leading-relaxed text-muted">
          Revisaste {hechas.length} prendas y quitaste {quitadas}.
          {quitadas > 0
            ? " Las quitadas siguen recuperables: se marcaron como borradas, no se destruyeron."
            : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <h1 className="text-lg font-semibold text-ink">¿Tienes esta prenda?</h1>
        <p className="text-sm leading-relaxed text-muted">
          Las que salieron de una foto con varias prendas las leyó un modelo, y
          si leyó de más nunca te enteras — salvo cuando aparece en un look. Van
          las más usadas primero.
        </p>
        <p className="text-sm font-semibold text-ink">
          {i + 1} de {prendas.length}
          {quitadas > 0 ? ` · ${quitadas} quitadas` : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <div className="mx-auto w-full max-w-xs overflow-hidden rounded-lg border border-line bg-bg">
          {p.url ? (
            <Image
              src={p.url}
              alt={p.nombre}
              width={320}
              height={320}
              className="h-auto w-full object-contain"
              unoptimized
            />
          ) : (
            <div className="flex aspect-square items-center justify-center text-sm text-muted">
              sin imagen
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold text-ink">{p.nombre}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            {p.hex ? (
              <span className="flex items-center gap-1">
                <span
                  className="inline-block h-3 w-3 rounded-full border border-line"
                  style={{ backgroundColor: p.hex }}
                />
                {p.color ?? p.hex}
              </span>
            ) : null}
            {[p.categoria, p.material].filter(Boolean).join(" · ")}
          </p>
          <p className="text-xs text-muted">{p.origen}</p>
          {p.usos > 0 ? (
            <p className="text-xs font-semibold text-ink">
              sale en {p.usos} {p.usos === 1 ? "look guardado" : "looks guardados"}
            </p>
          ) : null}
        </div>

        <div className="flex gap-3">
          <button
            disabled={pendiente}
            onClick={() => decidir(false)}
            className="flex-1 rounded-sm border border-line py-4 text-base font-semibold text-ink active:bg-tile disabled:opacity-50"
          >
            No la tengo
          </button>
          <button
            disabled={pendiente}
            onClick={() => decidir(true)}
            className="flex-1 rounded-sm bg-ink py-4 text-base font-semibold text-bg active:opacity-80 disabled:opacity-50"
          >
            Sí la tengo
          </button>
        </div>
      </div>
    </div>
  );
}
