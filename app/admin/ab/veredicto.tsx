"use client";

import { useState, useTransition } from "react";
import { guardarVeredicto, type Eleccion } from "./actions";

// El control de juicio de un par: qué lado le pareció mejor + por qué.
//
// "Iguales" está en medio y a propósito: sin esa opción, un par que de verdad no
// se distingue se fuerza a un lado y mete ruido en el conteo. En un A/B, los
// empates son información — si la mitad salen empatados, el cambio no se nota.
export function Veredicto({
  parN,
  eleccion: inicial,
  comentario: comentarioInicial,
}: {
  parN: number;
  eleccion: Eleccion | null;
  comentario: string;
}) {
  const [eleccion, setEleccion] = useState<Eleccion | null>(inicial);
  const [comentario, setComentario] = useState(comentarioInicial);
  const [guardado, setGuardado] = useState<"idle" | "ok" | "error">("idle");
  const [, startTransition] = useTransition();

  function guardar(campos: { eleccion?: Eleccion | null; comentario?: string }) {
    startTransition(async () => {
      const r = await guardarVeredicto(parN, campos).catch(() => ({ ok: false }));
      setGuardado(r.ok ? "ok" : "error");
      if (r.ok) setTimeout(() => setGuardado("idle"), 1500);
    });
  }

  const botón = (v: Eleccion, texto: string) => (
    <button
      type="button"
      onClick={() => {
        const nuevo = eleccion === v ? null : v;
        setEleccion(nuevo);
        guardar({ eleccion: nuevo });
      }}
      className={`min-h-11 flex-1 rounded-full border px-4 text-sm font-semibold transition-colors duration-200 ${
        eleccion === v
          ? "border-ink bg-ink text-bg"
          : "border-line text-muted hover:border-ink hover:text-ink"
      }`}
    >
      {texto}
    </button>
  );

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <div className="flex items-center gap-2">
        {botón("izq", "← Mejor la A")}
        {botón("igual", "Iguales")}
        {botón("der", "Mejor la B →")}
      </div>
      <div className="flex items-center gap-2">
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          onBlur={() => guardar({ comentario })}
          rows={2}
          placeholder="Por qué (opcional)…"
          className="w-full rounded-lg border border-line bg-bg p-2.5 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
        />
        {guardado === "ok" ? (
          <span className="shrink-0 text-xs text-success">guardado</span>
        ) : guardado === "error" ? (
          <span className="shrink-0 text-xs text-error">no se guardó</span>
        ) : null}
      </div>
    </div>
  );
}
