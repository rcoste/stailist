"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import type { GrupoDup } from "@/lib/duplicados";
import { fusionar, marcarDistintas } from "./actions";

// Una decisión por grupo, con las prendas a la vista.
//
// La máquina sugiere y explica su porqué; la persona decide. Ese reparto es el
// punto: Roberto avisó que tiene prendas parecidas que NO son la misma —"dos o
// tres grises diferentes, un cuello V y un crewneck"— y sus tres "Pantalón
// negro" resultaron ser de sintético, lana y algodón. Fusionar por nombre le
// habría borrado dos pantalones reales.

const COLOR: Record<GrupoDup["confianza"], string> = {
  idénticas: "bg-error text-bg",
  "muy parecidas": "bg-warning text-bg",
  distintas: "bg-tile text-muted",
};

export function DuplicadosClient({
  grupos,
  conservarPorGrupo,
}: {
  grupos: GrupoDup[];
  /** clave del grupo → id de la fila a conservar si se fusiona */
  conservarPorGrupo: Record<string, string>;
}) {
  const [resueltos, setResueltos] = useState<Record<string, string>>({});
  const [pendiente, empezar] = useTransition();

  const decidir = (g: GrupoDup, misma: boolean) => {
    empezar(async () => {
      const ids = g.filas.map((f) => f.id);
      const r = misma
        ? await fusionar(
            conservarPorGrupo[g.clave],
            ids.filter((id) => id !== conservarPorGrupo[g.clave])
          )
        : await marcarDistintas(ids);
      setResueltos((x) => ({
        ...x,
        [g.clave]:
          "error" in r
            ? `error: ${r.error}`
            : misma
              ? `fusionadas — quedó 1 de ${g.filas.length}`
              : "marcadas como distintas",
      }));
    });
  };

  const quedan = grupos.filter((g) => !resueltos[g.clave]).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
        <h1 className="text-lg font-semibold text-ink">
          Prendas que podrían estar repetidas
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Salieron midiendo por qué el motor usa siempre las mismas prendas. Una
          fila repetida no es solo ruido: cuando el motor elige “una sandalia”,
          está eligiendo entre cinco filas que son la misma.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          <span className="font-semibold text-ink">No se borra nada de verdad.</span>{" "}
          “Es la misma” conserva la fila con foto propia y más datos, y manda las
          otras al borrado suave — se deshace con un update.
        </p>
        <p className="text-sm font-semibold text-ink">{quedan} por decidir</p>
      </div>

      {grupos.map((g) => {
        const hecho = resueltos[g.clave];
        return (
          <section
            key={g.clave}
            className={`flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 ${hecho ? "opacity-50" : ""}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-ink">
                {g.filas.length}× {g.nombre}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${COLOR[g.confianza]}`}
              >
                {g.confianza}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted">{g.porque}</p>

            <div className="flex flex-wrap gap-3">
              {g.filas.map((f) => (
                <figure key={f.id} className="flex w-28 flex-col gap-1">
                  <div className="aspect-square overflow-hidden rounded-lg border border-line bg-bg">
                    {f.url ? (
                      <Image
                        src={f.url}
                        alt={f.nombre}
                        width={112}
                        height={112}
                        className="h-full w-full object-contain"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[10px] text-muted">
                        sin foto
                      </span>
                    )}
                  </div>
                  <figcaption className="text-[10px] leading-tight text-muted">
                    {f.hex ? (
                      <span className="flex items-center gap-1">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full border border-line"
                          style={{ backgroundColor: f.hex }}
                        />
                        {f.hex}
                      </span>
                    ) : null}
                    {[f.material, f.corte, f.manga].filter(Boolean).join(" · ") || "—"}
                    <br />
                    <span className="text-[9px]">
                      {f.tieneFoto ? "foto propia" : f.source ?? ""}
                      {f.id === conservarPorGrupo[g.clave] ? " · se conserva" : ""}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>

            {hecho ? (
              <p className="text-sm font-semibold text-ink">{hecho}</p>
            ) : (
              <div className="flex gap-3">
                <button
                  disabled={pendiente}
                  onClick={() => decidir(g, false)}
                  className="flex-1 rounded-xl border border-line py-3 text-sm font-semibold text-ink active:bg-tile disabled:opacity-50"
                >
                  Son distintas
                </button>
                <button
                  disabled={pendiente}
                  onClick={() => decidir(g, true)}
                  className="flex-1 rounded-xl bg-ink py-3 text-sm font-semibold text-bg active:opacity-80 disabled:opacity-50"
                >
                  Es la misma
                </button>
              </div>
            )}
          </section>
        );
      })}

      {grupos.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
          No hay prendas repetidas por revisar.
        </p>
      ) : null}
    </div>
  );
}
