"use client";

import { useState, useTransition } from "react";
import { CAMPOS_JUZGABLES, type FotoComparada, type Modo, type Veredicto } from "@/lib/comparador/tipos";
import { calificar } from "../actions";

// Una foto a la vez, grande, y debajo lo que vio cada modelo.
//
// LAS COLUMNAS NO TIENEN NOMBRE. Se llaman A, B, C y el orden se sortea por
// foto. Nadie califica igual sabiendo cuál es el modelo barato — y aquí la
// pregunta no admite gusto: la prenda está en la foto o no está.
//
// EN MODO "VARIAS" SE CALIFICAN TRES COSAS, no una:
//   ✗ sobra   — la prenda no está en la foto. EL ERROR CARO: una prenda
//               inventada se guarda con su render limpio, se ve igual de real
//               que las demás, y no hay forma de detectarla desde la app hasta
//               que sale en un outfit. A Roberto le tomó dos meses cazar tres.
//   faltaron  — cuántas prendas de la foto no listó.
//   campo mal — de las que sí vio, cuáles leyó mal.

const ETIQUETA_CAMPO: Record<string, string> = {
  nombre: "nombre",
  categoria: "categoría",
  color: "color",
  material: "material",
  formalidad: "formalidad",
  temporada: "temporada",
  patron: "patrón",
};

const LETRAS = ["A", "B", "C", "D", "E", "F", "G"];

type MarcaMulti = { inventadas: number[]; faltaron: number; camposMal: Record<string, string[]> };

export function CalificarClient({
  corridaId,
  modo,
  fotos,
  yaHechas,
  total,
}: {
  corridaId: string;
  modo: Modo;
  fotos: FotoComparada[];
  yaHechas: number;
  total: number;
}) {
  const [i, setI] = useState(0);
  const [marcas, setMarcas] = useState<Record<string, MarcaMulti>>({});
  const [pendiente, empezar] = useTransition();

  const foto = fotos[i];
  const de = (modeloId: string): MarcaMulti =>
    marcas[modeloId] ?? { inventadas: [], faltaron: 0, camposMal: {} };

  const marcarInventada = (modeloId: string, idx: number) =>
    setMarcas((m) => {
      const a = de(modeloId);
      return {
        ...m,
        [modeloId]: {
          ...a,
          inventadas: a.inventadas.includes(idx)
            ? a.inventadas.filter((x) => x !== idx)
            : [...a.inventadas, idx],
        },
      };
    });

  const marcarCampo = (modeloId: string, idx: number, campo: string) =>
    setMarcas((m) => {
      const a = de(modeloId);
      const k = String(idx);
      const antes = a.camposMal[k] ?? [];
      return {
        ...m,
        [modeloId]: {
          ...a,
          camposMal: {
            ...a.camposMal,
            [k]: antes.includes(campo) ? antes.filter((c) => c !== campo) : [...antes, campo],
          },
        },
      };
    });

  const cambiarFaltaron = (modeloId: string, d: number) =>
    setMarcas((m) => {
      const a = de(modeloId);
      return { ...m, [modeloId]: { ...a, faltaron: Math.max(0, a.faltaron + d) } };
    });

  const siguiente = () =>
    empezar(async () => {
      await Promise.all(
        foto.lecturas
          .filter((l) => !l.error)
          .map((l) => {
            const a = de(l.modeloId);
            const v: Veredicto =
              modo === "varias"
                ? {
                    inventadas: a.inventadas,
                    faltaron: a.faltaron,
                    // Se limpian las listas vacías para que el veredicto guardado
                    // diga sólo lo que de verdad falló.
                    camposMal: Object.fromEntries(
                      Object.entries(a.camposMal).filter(([, cs]) => cs.length)
                    ),
                  }
                : { camposMal: a.camposMal["0"] ?? [] };
            return calificar(foto.fotoId, l.modeloId, v);
          })
      );
      setMarcas({});
      if (i + 1 >= fotos.length) window.location.reload();
      else setI(i + 1);
    });

  if (!foto) return null;

  return (
    // pb-24: el botón de avanzar va fijo abajo y sin este colchón tapa el
    // contador de "prendas que se le fueron" de la última columna.
    <div className="flex flex-col gap-4 pb-24">
      <header className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
        <h1 className="text-lg font-semibold text-ink">
          {modo === "varias" ? "¿Qué le sobra, qué le falta, qué leyó mal?" : "¿Qué leyó mal?"}
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          {modo === "varias"
            ? "Toca ✗ en una prenda que NO esté en la foto. Toca un dato para marcarlo equivocado. Y abajo dile cuántas prendas de la foto se le fueron."
            : "Toca el dato que esté equivocado. Lo que no toques cuenta como acertado."}
        </p>
        <p className="text-sm font-semibold text-ink">
          foto {yaHechas + i + 1} de {total}
        </p>
      </header>

      {/* En escritorio la foto se queda fija mientras se marcan las columnas:
          cada dato que se califica se contesta MIRANDO la foto, y tener que
          subir y bajar por cada prenda convierte la revisión en un acto de
          memoria. En celular se apilan, que es donde ya funcionaba. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,380px)_1fr] lg:items-start">
        <div className="mx-auto w-full max-w-sm overflow-hidden rounded-xl border border-line bg-bg lg:sticky lg:top-4">
          {foto.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto.url} alt="" className="h-auto w-full object-contain" />
          ) : (
            <div className="flex aspect-square items-center justify-center text-sm text-muted">
              sin imagen
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
        {foto.lecturas.map((l, n) => {
          const prendas =
            modo === "varias"
              ? ((l.salida as Record<string, unknown>[] | null) ?? [])
              : l.salida
                ? [l.salida as Record<string, unknown>]
                : [];
          const a = de(l.modeloId);
          return (
            <div
              key={l.modeloId}
              className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
            >
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold text-ink">Modelo {LETRAS[n] ?? n + 1}</p>
                {!l.error ? (
                  <p className="text-xs text-muted">
                    {prendas.length} {prendas.length === 1 ? "prenda" : "prendas"}
                  </p>
                ) : null}
              </div>

              {l.error ? (
                <p className="text-sm text-error">No pudo leerla: {l.error}</p>
              ) : (
                <>
                  {prendas.map((p, idx) => {
                    const inventada = a.inventadas.includes(idx);
                    return (
                      <div
                        key={idx}
                        className={`flex flex-col gap-2 rounded-lg border p-3 ${
                          inventada ? "border-error bg-error/5 opacity-60" : "border-line"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm font-semibold text-ink ${
                              inventada ? "line-through" : ""
                            }`}
                          >
                            {String(p.nombre ?? "(sin nombre)")}
                          </p>
                          {modo === "varias" ? (
                            <button
                              onClick={() => marcarInventada(l.modeloId, idx)}
                              title="esta prenda no está en la foto"
                              className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${
                                inventada
                                  ? "border-error bg-error text-bg"
                                  : "border-line text-muted"
                              }`}
                            >
                              ✗ no está
                            </button>
                          ) : null}
                        </div>

                        {!inventada ? (
                          <div className="flex flex-wrap gap-1.5">
                            {CAMPOS_JUZGABLES.filter((c) => c !== "nombre").map((campo) => {
                              const valor = p[campo];
                              if (valor == null || valor === "") return null;
                              const mal = (a.camposMal[String(idx)] ?? []).includes(campo);
                              return (
                                <button
                                  key={campo}
                                  onClick={() => marcarCampo(l.modeloId, idx, campo)}
                                  className={`flex flex-col items-start rounded-lg border px-2 py-1 text-left ${
                                    mal
                                      ? "border-error bg-error/10 line-through decoration-error"
                                      : "border-line"
                                  }`}
                                >
                                  <span className="text-[10px] uppercase tracking-wide text-muted">
                                    {ETIQUETA_CAMPO[campo] ?? campo}
                                  </span>
                                  <span className="text-xs font-medium text-ink">
                                    {String(valor)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                  {modo === "varias" ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-bg p-2">
                      <span className="text-xs text-muted">Prendas de la foto que se le fueron</span>
                      <span className="flex items-center gap-2">
                        <button
                          onClick={() => cambiarFaltaron(l.modeloId, -1)}
                          className="h-7 w-7 rounded-full border border-line text-sm font-semibold text-ink"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-semibold text-ink tabular-nums">
                          {a.faltaron}
                        </span>
                        <button
                          onClick={() => cambiarFaltaron(l.modeloId, 1)}
                          className="h-7 w-7 rounded-full border border-line text-sm font-semibold text-ink"
                        >
                          +
                        </button>
                      </span>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
        </div>
      </div>

      <button
        disabled={pendiente}
        onClick={siguiente}
        className="sticky bottom-4 rounded-xl bg-ink py-4 text-base font-semibold text-bg active:opacity-80 disabled:opacity-50"
      >
        {pendiente
          ? "Guardando…"
          : i + 1 >= fotos.length
            ? "Terminar y ver quién ganó"
            : "Siguiente foto"}
      </button>
    </div>
  );
}
