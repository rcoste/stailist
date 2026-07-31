"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { saveStyleWords } from "@/app/perfil/actions";
import { STYLE_WORDS_MAX } from "@/lib/style-words";

// "Tu estilo en tus palabras": texto libre opcional. La señal más directa que
// puede dar la persona; entra a todos los motores (Hoy, cápsula, viaje).
//
// DEJÓ DE SER UNA CARD PROPIA (2026-07-28). Vivía pegada debajo de "tu estilo de
// referencia" y las dos preguntaban lo mismo — "dime cuál es tu estilo", una con
// fotos y otra con texto — con el mismo peso visual. Roberto se confundió de
// cuál era cuál, y él las mandó construir; un usuario no tenía oportunidad. Peor:
// la petición fácil de contestar (señalar una foto) competía contra la difícil
// (articular tu estilo por escrito), que casi nadie puede hacer.
//
// Ahora es un renglón DENTRO de la card de referencia: cerrado por default, se
// abre si quieres. El texto sigue yendo íntegro a todos los motores — lo que
// cambió es cuánto lo pedimos, no cuánto vale cuando existe.
export function StyleWordsCard({
  initial,
  variant = "card",
  onSaved,
}: {
  initial: string | null;
  /** "card" = bloque propio (legacy). "inline" = renglón dentro de otra card. */
  variant?: "card" | "inline";
  /** Avisa al contenedor que el estilo cambió (deja la cápsula desactualizada). */
  onSaved?: () => void;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [error, setError] = useState(false);
  const [busy, start] = useTransition();
  // Inline arranca cerrado salvo que ya haya algo escrito (si escribiste, lo ves).
  const [open, setOpen] = useState(variant === "card" || !!initial);
  const dirty = value.trim() !== saved.trim();

  function guardar() {
    setError(false);
    start(async () => {
      const r = await saveStyleWords(value);
      if (r.ok) {
        setSaved(value.trim());
        onSaved?.();
      } else setError(true);
    });
  }

  const campo = (
    <>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, STYLE_WORDS_MAX))}
        rows={3}
        maxLength={STYLE_WORDS_MAX}
        placeholder='Ej: "básicos bien cortados, casi todo neutro, nada de logos ni estampados".'
        className="w-full resize-none rounded-sm border border-line bg-bg p-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
      />
      {error ? (
        <p className="text-xs text-error">No se pudo guardar. Inténtalo de nuevo.</p>
      ) : null}
    </>
  );

  if (variant === "inline") {
    return (
      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink transition-colors hover:text-accent"
          >
            <Icon
              name="chevron"
              size={14}
              rotate={open ? 90 : 0}
              className="shrink-0 text-muted"
            />
            ¿algo más que deba saber?
          </button>
          {dirty ? (
            <button
              onClick={guardar}
              disabled={busy}
              className="shrink-0 text-[11.5px] font-medium text-accent hover:text-accent-deep disabled:opacity-50"
            >
              {busy ? "guardando…" : "guardar"}
            </button>
          ) : saved ? (
            <span className="text-[11px] text-muted">guardado</span>
          ) : null}
        </div>
        {open ? (
          <div className="flex flex-col gap-2">
            <p className="text-[12px] leading-snug text-muted">
              Si hay algo que las fotos no dicen — un corte que odias, algo que
              nunca te pondrías — escríbelo y lo tomo en cuenta.
            </p>
            {campo}
          </div>
        ) : saved ? (
          <p className="line-clamp-2 text-[12px] leading-snug text-muted">{saved}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Tu estilo en tus palabras
        </span>
        {dirty ? (
          <button
            onClick={guardar}
            disabled={busy}
            className="shrink-0 text-[11.5px] font-medium text-accent hover:text-accent-deep disabled:opacity-50"
          >
            {busy ? "guardando…" : "guardar"}
          </button>
        ) : saved ? (
          <span className="text-[11px] text-muted">guardado</span>
        ) : null}
      </div>
      {campo}
      <p className="text-xs text-muted">
        Opcional — pero es la señal más directa que me puedes dar: la uso en cada
        look, en tus esenciales y al armar tu maleta.
      </p>
    </div>
  );
}
