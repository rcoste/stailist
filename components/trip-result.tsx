"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { PrendaZoom, type PrendaZoomData } from "@/components/prenda-zoom";
import {
  setTripPacked,
  setTripSubstitute,
  suggestTripSubstitutes,
  markTripFaltaOwned,
  type SubstituteCandidate,
} from "@/lib/trip-actions";
import { useTripGen } from "@/components/trip-gen-context";

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
  // Flujo maleta→looks (CTA "Generar/Ver mis looks"): viene del context de TripTabs,
  // no por props — cruzan la frontera RSC y la inyección por cloneElement no llegaba
  // (botón muerto). Ver components/trip-gen-context.
  const { onGenerateLooks, onViewLooks, looksExist, generating } = useTripGen();
  const [packed, setPacked] = useState<Record<string, boolean>>(empacadoInicial);
  const [zoom, setZoom] = useState<(PrendaZoomData & { index: number }) | null>(null);
  // Sustitutos elegidos en esta sesión (optimista; el server los persiste).
  const [localSub, setLocalSub] = useState<
    Record<number, { by: string; byImage: string | null }>
  >({});
  // Flujo "Buscar en mi clóset": hoja con candidatos de la IA.
  const [subFlow, setSubFlow] = useState<{
    index: number;
    nombre: string;
    status: "loading" | "done" | "empty" | "error";
    candidates: SubstituteCandidate[];
  } | null>(null);
  const isPacked = (i: number) => !!packed[String(i)];
  const router = useRouter();
  // "Ya lo tengo" en curso por índice (agrega al clóset + genera imagen, ~unos seg).
  const [ownBusy, setOwnBusy] = useState<Set<number>>(new Set());

  // by/byImage efectivos: el sustituto elegido esta sesión gana sobre lo del server.
  const ov = (r: TripRow) => localSub[r.index] ?? { by: r.by, byImage: r.byImage };

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

  // "Ya lo tengo" sobre un faltante: lo suma a tu clóset de verdad + le genera
  // imagen (server, inline) y lo marca cubierto en el viaje. Spinner mientras;
  // al terminar, refresca y la prenda se reubica en "Empaca esto" con su imagen.
  async function marcarYaLoTengo(index: number) {
    setOwnBusy((s) => new Set(s).add(index));
    const res = await markTripFaltaOwned(tripId, index);
    if (res.ok) router.refresh();
    setOwnBusy((s) => {
      const n = new Set(s);
      n.delete(index);
      return n;
    });
  }

  async function buscarSustituto(r: TripRow) {
    setSubFlow({ index: r.index, nombre: r.nombre, status: "loading", candidates: [] });
    try {
      const cands = await suggestTripSubstitutes(tripId, r.index);
      setSubFlow({
        index: r.index,
        nombre: r.nombre,
        status: cands.length ? "done" : "empty",
        candidates: cands,
      });
    } catch {
      setSubFlow({ index: r.index, nombre: r.nombre, status: "error", candidates: [] });
    }
  }

  function elegirSustituto(index: number, c: SubstituteCandidate) {
    setLocalSub((s) => ({ ...s, [index]: { by: c.nombre, byImage: c.image } }));
    setPacked((p) => ({ ...p, [String(index)]: true }));
    setSubFlow(null);
    setTripSubstitute(tripId, index, c.nombre);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Progreso de empacado */}
      <div className="flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent"
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
              const { by, byImage } = ov(r);
              return (
                <li key={r.index} className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setZoom({
                        index: r.index,
                        image: byImage,
                        nombre: by ?? r.nombre,
                        sub: r.porque,
                      })
                    }
                    title={by ?? r.nombre}
                    aria-label={`Ver ${by ?? r.nombre}`}
                    className="block w-full"
                  >
                    <span className="relative block aspect-[3/4] overflow-hidden rounded-md border border-line bg-surface">
                      {byImage ? (
                        <Image
                          src={byImage}
                          alt={by ?? r.nombre}
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
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePacked(r.index)}
                    aria-label={on ? "Quitar de la maleta" : "Empacar"}
                    aria-pressed={on}
                    className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center"
                  >
                    <span
                      className={`flex h-[19px] w-[19px] items-center justify-center rounded-full ${
                        on ? "bg-accent text-on-accent" : "border-[1.5px] border-line bg-bg/85"
                      }`}
                    >
                      {on ? <Icon name="check" size={12} strokeWidth={2.4} /> : null}
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
                className="flex flex-col gap-2.5 rounded-md border border-dashed border-accent/40 bg-accent-soft px-[13px] py-[11px]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-sm border border-accent/30 bg-surface text-accent">
                    <Icon name="mas" size={16} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="text-[13px] font-semibold leading-tight text-ink">{r.nombre}</b>
                    <span className="text-[11.5px] leading-snug text-muted">{r.porque}</span>
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => buscarSustituto(r)}
                    className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-sm bg-accent text-xs font-semibold text-on-accent transition-colors hover:bg-accent-deep"
                  >
                    <Icon name="lupa" size={13} /> buscar en mi clóset
                  </button>
                  <button
                    type="button"
                    onClick={() => marcarYaLoTengo(r.index)}
                    disabled={ownBusy.has(r.index)}
                    className="flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-line bg-surface px-[11px] text-xs font-semibold text-ink transition-colors hover:border-ink disabled:opacity-50"
                  >
                    {ownBusy.has(r.index) ? (
                      <>
                        <Spinner className="h-3.5 w-3.5" /> agregando…
                      </>
                    ) : (
                      <>
                        <Icon name="check" size={13} /> ya lo tengo
                      </>
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Cierre del paso "maleta": de aquí se pasa a generar los looks. */}
      {empaca.length > 0 ? (
        <div className="flex flex-col gap-1.5 pt-1">
          {looksExist ? (
            <button
              type="button"
              onClick={onViewLooks}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm border border-line bg-surface text-sm font-semibold text-ink transition-colors duration-200 hover:border-ink"
            >
              ver mis looks
            </button>
          ) : (
            <button
              type="button"
              onClick={onGenerateLooks}
              disabled={generating}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-accent text-sm font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
            >
              <Icon name="destello" size={18} /> generar mis looks
            </button>
          )}
          {!looksExist && falta.length > 0 ? (
            <p className="text-center text-[11.5px] text-muted">
              Los armo con lo que ya empacas — te {falta.length === 1 ? "falta" : "faltan"}{" "}
              {falta.length} {falta.length === 1 ? "prenda" : "prendas"}.
            </p>
          ) : null}
        </div>
      ) : null}

      <PrendaZoom
        data={zoom}
        onClose={() => setZoom(null)}
        action={
          zoom ? (
            <button
              type="button"
              onClick={() => {
                togglePacked(zoom.index);
                setZoom(null);
              }}
              className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-sm text-sm font-semibold transition-colors duration-200 ${
                isPacked(zoom.index)
                  ? "border border-line bg-surface text-muted hover:border-ink hover:text-ink"
                  : "bg-accent text-on-accent hover:bg-accent-deep"
              }`}
            >
              {isPacked(zoom.index) ? (
                "quitar de la maleta"
              ) : (
                <>
                  <Icon name="check" size={16} /> empacar
                </>
              )}
            </button>
          ) : null
        }
      />

      {subFlow ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50"
          onClick={() => setSubFlow(null)}
        >
          <div
            className="flex max-h-[85dvh] w-full max-w-[430px] flex-col gap-3 overflow-y-auto rounded-t-[18px] bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"
            style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="h-1 w-9 rounded-full bg-line" aria-hidden />
              <button
                type="button"
                onClick={() => setSubFlow(null)}
                aria-label="Cerrar"
                className="-mr-1 flex h-9 w-9 items-center justify-center text-muted hover:text-ink"
              >
                <Icon name="equis" size={20} />
              </button>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">
                Sustituir
              </span>
              <span className="editorial text-h3 leading-tight text-ink">{subFlow.nombre}</span>
            </div>

            {subFlow.status === "loading" ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Spinner className="h-7 w-7 text-accent" />
                <p className="editorial text-base text-ink">buscando en tu clóset…</p>
              </div>
            ) : null}

            {subFlow.status === "empty" ? (
              <p className="rounded-md border border-line bg-bg px-4 py-6 text-center text-sm text-muted">
                Nada de tu clóset lo cubre bien — para esta tendrías que conseguirla.
              </p>
            ) : null}

            {subFlow.status === "error" ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-sm text-error">
                  El servicio está ocupado un momento — espera unos segundos y reintenta.
                </p>
                <button
                  type="button"
                  onClick={() => buscarSustituto({ ...rows[subFlow.index] })}
                  className="min-h-10 rounded-sm border border-line bg-surface px-4 text-sm font-medium text-ink hover:border-ink"
                >
                  Reintentar
                </button>
              </div>
            ) : null}

            {subFlow.status === "done" ? (
              <ul className="flex flex-col gap-2 pb-1">
                {subFlow.candidates.map((c) => (
                  <li key={c.nombre}>
                    <button
                      type="button"
                      onClick={() => elegirSustituto(subFlow.index, c)}
                      className="flex w-full items-center gap-3 rounded-md border border-line bg-surface p-2.5 text-left transition-colors hover:border-accent"
                    >
                      <span className="h-16 w-12 shrink-0 overflow-hidden rounded-sm border border-line bg-bg">
                        {c.image ? (
                          <Image
                            src={c.image}
                            alt={c.nombre}
                            width={48}
                            height={64}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-muted">
                            <Icon name="gancho" size={18} />
                          </span>
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <b className="text-sm font-semibold leading-tight text-ink">{c.nombre}</b>
                        {c.porque ? (
                          <span className="text-[11.5px] leading-snug text-muted">{c.porque}</span>
                        ) : null}
                      </span>
                      <Icon name="chevron" size={16} className="shrink-0 text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
