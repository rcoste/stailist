"use client";

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
// Vive aparte del card porque tiene DOS entradas y el handoff del card de duelo
// es explícito en que las dos abren la misma hoja:
//   · `ninguna de las dos me va`, la salida del duelo;
//   · `no me va`, el tercer botón del pie del card ya resuelto.
// Duplicarla era garantizar que se desincronizaran.
//
// Dos pasos: el motivo primero y, CON el motivo en mano, la resolución
// (reemplazo o fuera). Al tope de swaps el paso 2 se salta — no hay reemplazo
// que ofrecer — y el chip resuelve directo.
export function MotivoSheet({
  open,
  onClose,
  motivo,
  onMotivo,
  puedeReemplazar,
  onReemplazar,
  onQuitar,
}: {
  open: boolean;
  onClose: () => void;
  /** Motivo elegido en el paso 1; null = todavía en los chips. Lo controla el
   *  padre para que cerrar la hoja lo limpie junto con `open`. */
  motivo: VetoReason | null;
  onMotivo: (r: VetoReason) => void;
  /** false cuando ya no se ofrecen más reemplazos (tope de swaps). */
  puedeReemplazar: boolean;
  onReemplazar: (reason: VetoReason) => void;
  onQuitar: (reason: VetoReason) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose}>
      {motivo === null ? (
        <>
          <h3 className="display text-[23px] font-normal italic leading-[27px] text-ink">
            ¿por qué no?
          </h3>
          <p className="mt-[5px] text-[12.5px] leading-[18px] text-muted">
            me sirve para no repetir el error.
          </p>
          <div className="mt-[15px] flex flex-wrap gap-[7px] pb-1">
            {VETO_REASONS_OFRECIDOS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  if (puedeReemplazar) {
                    onMotivo(r);
                  } else {
                    onClose();
                    onQuitar(r);
                  }
                }}
                className="flex min-h-11 items-center border border-line bg-surface px-3.5 text-[13px] font-semibold text-ink2 transition-colors hover:border-ink hover:bg-tile"
              >
                {VETO_REASON_LABEL[r]}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <h3 className="display text-[23px] font-normal italic leading-[27px] text-ink">
            vale — {VETO_REASON_LABEL[motivo]}.
          </h3>
          <p className="mt-[5px] text-[12.5px] leading-[18px] text-muted">
            ¿te busco un reemplazo con eso en mente, o la quito?
          </p>
          <div className="mt-[15px] flex flex-col gap-[7px] pb-1">
            <button
              type="button"
              onClick={() => {
                onClose();
                onReemplazar(motivo);
              }}
              className="flex min-h-11 items-center justify-center border border-ink bg-surface px-3.5 text-[13px] font-bold text-ink transition-colors hover:bg-tile"
            >
              búscame un reemplazo
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onQuitar(motivo);
              }}
              className="flex min-h-11 items-center justify-center border border-line bg-surface px-3.5 text-[13px] font-semibold text-muted transition-colors hover:border-ink hover:bg-tile hover:text-ink"
            >
              solo quítala
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
