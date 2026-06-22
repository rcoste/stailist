import { forwardRef } from "react";
import type { PasaporteData } from "@/lib/pasaporte";

// La tarjeta del Pasaporte de estilo: plantilla de marca rellenada con los datos
// del usuario. Sin imágenes externas (solo color + texto) → se captura limpio
// como PNG con html-to-image. forwardRef para que el botón de compartir la tome.
export const PasaporteCard = forwardRef<HTMLDivElement, { data: PasaporteData }>(
  function PasaporteCard({ data }, ref) {
    return (
      <div
        ref={ref}
        className="flex w-[360px] flex-col gap-5 rounded-2xl border border-line border-t-[3px] border-t-accent bg-bg p-6"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[1.5px] text-muted">
            Pasaporte de estilo
          </span>
          <span className="editorial text-base italic text-accent">stailist</span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-muted">{data.name}</span>
          {data.archetypeNombre ? (
            <>
              <span className="editorial text-[28px] leading-tight text-ink">
                {data.archetypeNombre}
              </span>
              {data.archetypeDesc ? (
                <span className="mt-1 text-xs text-muted">{data.archetypeDesc}</span>
              ) : null}
            </>
          ) : (
            <span className="editorial text-[28px] leading-tight text-ink">Tu estilo</span>
          )}
        </div>

        {data.swatches.length > 0 ? (
          <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Tu paleta{data.seasonLabel ? ` · ${data.seasonLabel}` : ""}
            </span>
            <div className="flex gap-1.5">
              {data.swatches.map((hex, i) => (
                <span
                  key={i}
                  className="h-9 flex-1 rounded-md border border-line"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
        ) : null}

        {data.powerColors.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm text-ink">
              Tus colores que te <span className="text-accent">encienden la cara</span>
            </span>
            <div className="flex flex-wrap gap-3.5">
              {data.powerColors.map((c) => (
                <span key={c.hex + c.nombre} className="flex items-center gap-2">
                  <span
                    className="h-[18px] w-[18px] rounded-full border border-line"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="text-xs text-muted">{c.nombre}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {data.siluetaLine ? (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Tu silueta
            </span>
            <span className="text-sm text-ink">{data.siluetaLine}</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-[11px] text-muted">Hecho con stailist</span>
          <span className="text-xs text-accent">Haz el tuyo en stailist.co</span>
        </div>
      </div>
    );
  }
);
