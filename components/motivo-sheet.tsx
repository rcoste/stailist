"use client";

import { useState } from "react";
import { Sheet } from "@/components/sheet";
import {
  VETO_REASONS_OFRECIDOS,
  VETO_REASON_LABEL,
  type VetoReason,
} from "@/lib/capsule";

// La hoja de "¿por qué no?" — OBLIGATORIA: descartar una prenda nunca resuelve
// sin motivo, porque el motivo es la señal que evita repetir el error
// (REASON_HINT del motor).
//
// Vive aparte del card porque tiene VARIAS entradas y todas deben verse igual:
//   · `ninguna de las dos me va`, la salida del duelo (cápsula y viaje);
//   · `no me va`, el tercer botón del pie del card ya resuelto (cápsula);
//   · "no lo necesito" y "no me gusta esta pieza" del menú ··· del viaje.
// Duplicarla era garantizar que se desincronizaran.
//
// Dos pasos: el motivo primero y, CON el motivo en mano, la resolución
// (reemplazo o fuera). Sin reemplazo que ofrecer, el chip resuelve directo.
//
// El VIAJE (2026-10-14) le pasa sus propios motivos (los de función: "no es
// práctico para caminar", "no va con el clima"), un campo para escribirlo con
// sus palabras y los nombres de sus dos salidas. Sin esas props, la hoja es
// exactamente la de la cápsula.
export function MotivoSheet({
  open,
  onClose,
  motivo,
  onMotivo,
  puedeReemplazar,
  onReemplazar,
  onQuitar,
  motivos = VETO_REASONS_OFRECIDOS,
  conNota = false,
  textoReemplazar = "búscame un reemplazo",
  textoQuitar = "solo quítala",
  pregunta = "¿te busco un reemplazo con eso en mente, o la quito?",
}: {
  open: boolean;
  onClose: () => void;
  /** Motivo elegido en el paso 1; null = todavía en los chips. Lo controla el
   *  padre para que cerrar la hoja lo limpie junto con `open`. */
  motivo: VetoReason | null;
  onMotivo: (r: VetoReason) => void;
  /** false cuando no hay reemplazo que ofrecer: el chip resuelve directo. */
  puedeReemplazar: boolean;
  onReemplazar: (reason: VetoReason, nota: string | null) => void;
  onQuitar: (reason: VetoReason, nota: string | null) => void;
  motivos?: VetoReason[];
  /** Campo para escribir el motivo con sus palabras (opcional para la persona). */
  conNota?: boolean;
  textoReemplazar?: string;
  textoQuitar?: string;
  pregunta?: string;
}) {
  const [nota, setNota] = useState("");
  const notaFinal = () => (conNota && nota.trim() ? nota.trim() : null);
  const cerrar = () => {
    setNota("");
    onClose();
  };
  return (
    <Sheet open={open} onClose={cerrar}>
      {motivo === null ? (
        <>
          <h3 className="display text-[23px] font-normal italic leading-[27px] text-ink">
            ¿por qué no?
          </h3>
          <p className="mt-[5px] text-[12.5px] leading-[18px] text-muted">
            me sirve para no repetir el error.
          </p>
          <div className="mt-[15px] flex flex-wrap gap-[7px] pb-1">
            {motivos.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  if (puedeReemplazar) {
                    onMotivo(r);
                  } else {
                    const n = notaFinal();
                    cerrar();
                    onQuitar(r, n);
                  }
                }}
                className="flex min-h-11 items-center border border-line bg-surface px-3.5 text-[13px] font-semibold text-ink2 transition-colors hover:border-ink hover:bg-tile"
              >
                {VETO_REASON_LABEL[r]}
              </button>
            ))}
          </div>
          {conNota ? (
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="o escríbelo con tus palabras (opcional)"
              className="mt-3 w-full resize-none border border-line bg-surface px-3 py-2.5 text-[13px] text-ink placeholder:text-faint focus:border-ink focus:outline-none"
            />
          ) : null}
        </>
      ) : (
        <>
          <h3 className="display text-[23px] font-normal italic leading-[27px] text-ink">
            vale — {VETO_REASON_LABEL[motivo]}.
          </h3>
          <p className="mt-[5px] text-[12.5px] leading-[18px] text-muted">{pregunta}</p>
          <div className="mt-[15px] flex flex-col gap-[7px] pb-1">
            <button
              type="button"
              onClick={() => {
                const n = notaFinal();
                cerrar();
                onReemplazar(motivo, n);
              }}
              className="flex min-h-11 items-center justify-center border border-ink bg-surface px-3.5 text-[13px] font-bold text-ink transition-colors hover:bg-tile"
            >
              {textoReemplazar}
            </button>
            <button
              type="button"
              onClick={() => {
                const n = notaFinal();
                cerrar();
                onQuitar(motivo, n);
              }}
              className="flex min-h-11 items-center justify-center border border-line bg-surface px-3.5 text-[13px] font-semibold text-muted transition-colors hover:border-ink hover:bg-tile hover:text-ink"
            >
              {textoQuitar}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
