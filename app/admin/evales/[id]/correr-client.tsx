"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatoUsd } from "@/lib/proveedores/precios";

// Correr los pasos pendientes por BLOQUES, con el gasto a la vista.
//
// Un paso es "generar un brief" o "calificar sus looks" (60s de Vercel por
// función), y el servidor decide cuál toca por los DATOS de la fila. Por eso
// el mismo brief puede necesitar DOS pasos y esta pantalla los pide en dos
// pasadas: es más simple que llevar la cuenta aquí, y reintentable gratis.

type Pendiente = { id: string; n: number; etiqueta: string };

const PASOS_POR_BLOQUE = 6;

export function CorrerClient({
  corridaId,
  pendientes,
  hechos,
  total,
  estimado,
}: {
  corridaId: string;
  pendientes: Pendiente[];
  hechos: number;
  total: number;
  estimado: number | null;
}) {
  const router = useRouter();
  const [listos, setListos] = useState<Set<string>>(new Set());
  const [fase, setFase] = useState<"listo" | "corriendo" | "pausa">("listo");
  const [fallos, setFallos] = useState<string[]>([]);
  const corriendo = useRef(false);

  const correrBloque = async () => {
    if (corriendo.current) return;
    corriendo.current = true;
    setFase("corriendo");
    const cola = pendientes.filter((p) => !listos.has(p.id)).slice(0, PASOS_POR_BLOQUE);
    let i = 0;
    const nuevos = new Set(listos);
    // Dos a la vez: un paso de generación tarda 25-45s y los proveedores
    // aguantan dos. Los pasos de calificación son mucho más rápidos.
    const obreros = Array.from({ length: 2 }, async () => {
      while (i < cola.length) {
        const p = cola[i++];
        try {
          const r = await fetch("/api/admin/evales/paso", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ corridaId, briefId: p.id }),
          });
          const json = (await r.json()) as { ok?: boolean; fallo?: string; error?: string };
          if (json.error) setFallos((xs) => [...xs, `${p.etiqueta}: ${json.error}`]);
          else {
            if (json.fallo) setFallos((xs) => [...xs, `${p.etiqueta}: ${json.fallo}`]);
            nuevos.add(p.id);
          }
        } catch {
          setFallos((xs) => [...xs, `${p.etiqueta}: la petición no llegó (se reintenta)`]);
        }
        setListos(new Set(nuevos));
      }
    });
    await Promise.all(obreros);
    corriendo.current = false;
    // Siempre se recarga: el servidor recalcula qué falta. Un brief recién
    // generado vuelve a aparecer pendiente — ahora para calificarse.
    router.refresh();
    setFase("pausa");
  };

  const avance = hechos + listos.size;
  const pct = total ? Math.round((avance / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-ink">
        {avance} de {total} briefs listos
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-tile">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>

      {fase !== "corriendo" ? (
        <>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-bg p-3">
            <span className="text-sm text-muted">Lo que falta cuesta más o menos</span>
            <span className="text-base font-semibold text-ink">
              {estimado === null ? "—" : formatoUsd(estimado)}
            </span>
          </div>
          <button
            onClick={correrBloque}
            className="rounded-xl bg-ink py-4 text-base font-semibold text-bg active:opacity-80"
          >
            Correr {Math.min(PASOS_POR_BLOQUE, pendientes.length)} pasos
          </button>
          <p className="text-xs text-muted">
            Cada brief lleva dos pasos: generar (el motor completo, 25-45s) y
            calificar (los tres jueces). No cierres esta pantalla: lo que no se
            pide, no se cobra.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted">Corriendo… no cierres la pantalla.</p>
      )}

      {fallos.length ? (
        <div className="flex flex-col gap-1 border-t border-line pt-2">
          <p className="text-xs font-semibold text-error">Pasos que fallaron</p>
          {fallos.slice(-6).map((f, i) => (
            <p key={i} className="text-xs text-muted">
              {f}
            </p>
          ))}
          <p className="text-xs text-muted">
            Lo que falló queda pendiente y entra en el siguiente bloque. Un juez
            caído no tira lo que el otro sí calificó.
          </p>
        </div>
      ) : null}
    </div>
  );
}
