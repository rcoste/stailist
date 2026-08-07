"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatoUsd } from "@/lib/proveedores/precios";
import { estimadoEval } from "@/lib/evales/evales";
import { abrirEvalCorrida } from "./actions";

// Abrir una corrida de eval. No hay nada que elegir salvo el tamaño: la
// variante SIEMPRE es producción (eso es lo que el eval mide) y el pool está
// congelado. Un eval con opciones sería otro comparador.

export function NuevoEval() {
  const router = useRouter();
  const [vueltas, setVueltas] = useState(1);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nBriefs = vueltas * 13;
  const estimado = estimadoEval(nBriefs);

  const crear = async () => {
    setCreando(true);
    setError(null);
    const r = await abrirEvalCorrida({ vueltas });
    if ("error" in r) {
      setError(r.error);
      setCreando(false);
      return;
    }
    router.push(`/admin/evales/${r.id}`);
  };

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted">
          Vueltas al pool ({nBriefs} días · ~{nBriefs * 3} looks)
        </label>
        <div className="flex gap-2">
          {[1, 2, 3].map((v) => (
            <button
              key={v}
              onClick={() => setVueltas(v)}
              className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition-colors ${
                vueltas === v
                  ? "border-accent bg-accent text-on-accent"
                  : "border-line text-ink active:bg-tile"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          Una vuelta es el pool completo: las ocasiones por las bandas de clima,
          los dos casos de lluvia y el espejo del trabajo. Más vueltas = menos
          ruido por la varianza del modelo, mismo dinero por vuelta.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-bg p-3">
        <span className="text-sm text-muted">Cuesta más o menos</span>
        <span className="text-base font-semibold text-ink">
          {estimado === null ? "—" : formatoUsd(estimado)}
        </span>
      </div>

      {error ? <p className="text-xs text-error">{error}</p> : null}

      <button
        onClick={crear}
        disabled={creando}
        className="rounded-xl bg-ink py-3 text-sm font-semibold text-bg active:opacity-80 disabled:opacity-50"
      >
        {creando ? "Abriendo…" : "Correr un eval"}
      </button>
    </div>
  );
}
