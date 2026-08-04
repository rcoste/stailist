"use client";

import { useState, useTransition } from "react";
import { guardarNota, type Veredicto } from "./actions";

// El control de juicio de un look: acertó / exageró + comentario libre.
//
// SIN BOTÓN DE GUARDAR a propósito. Son ~50 juicios escritos a mano de corrido;
// un botón por look son 50 clics más y, sobre todo, 50 oportunidades de perder
// lo escrito por cerrar la pestaña. El veredicto guarda al tocarlo y el
// comentario al salir del campo.
export function Nota({
  lookN,
  veredicto: inicial,
  comentario: comentarioInicial,
}: {
  lookN: number;
  veredicto: Veredicto | null;
  comentario: string;
}) {
  const [veredicto, setVeredicto] = useState<Veredicto | null>(inicial);
  const [comentario, setComentario] = useState(comentarioInicial);
  const [guardado, setGuardado] = useState<"idle" | "ok" | "error">("idle");
  const [, startTransition] = useTransition();

  function guardar(campos: { veredicto?: Veredicto | null; comentario?: string }) {
    startTransition(async () => {
      const r = await guardarNota(lookN, campos).catch(() => ({ ok: false }));
      setGuardado(r.ok ? "ok" : "error");
      // El "guardado" se borra solo: dejarlo fijo llena la pantalla de avisos
      // cuando llevas veinte looks revisados.
      if (r.ok) setTimeout(() => setGuardado("idle"), 1500);
    });
  }

  const botón = (v: Veredicto, texto: string) => (
    <button
      type="button"
      onClick={() => {
        // Volver a tocar el mismo lo quita: cambiar de opinión es parte de revisar.
        const nuevo = veredicto === v ? null : v;
        setVeredicto(nuevo);
        guardar({ veredicto: nuevo });
      }}
      className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors duration-200 ${
        veredicto === v
          ? "border-ink bg-ink text-bg"
          : "border-line text-muted hover:border-ink hover:text-ink"
      }`}
    >
      {texto}
    </button>
  );

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">
          tu veredicto
        </span>
        {botón("acerto", "Acertó")}
        {botón("exagero", "Exageró")}
        {guardado === "ok" ? (
          <span className="text-xs text-success">guardado</span>
        ) : guardado === "error" ? (
          <span className="text-xs text-error">no se guardó — reintenta</span>
        ) : null}
      </div>
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        onBlur={() => guardar({ comentario })}
        rows={2}
        placeholder="Qué le ves de malo (o de bueno) a este look…"
        className="w-full rounded-lg border border-line bg-bg p-2.5 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
      />
    </div>
  );
}
