import { forwardRef } from "react";
import { METAL_HEX } from "@/lib/colorimetria";
import type { PasaporteData } from "@/lib/pasaporte";

// Etiqueta de sección sobre la tarjeta OSCURA (rebrand v3): blanco a baja opacidad.
const SECLBL = "text-[10px] font-bold uppercase tracking-[0.07em] text-white/45";

// La tarjeta del Pasaporte de estilo: la pieza de identidad compartible. Rebrand
// v3 → tarjeta NEGRA (#141414) con la paleta y las prendas del usuario como único
// color (el contraste las hace brillar). Diverge a propósito al radius-artifact
// (~10px) para leerse como objeto físico. Sin imágenes externas (avatar/prendas
// entran como data URL) → se captura limpio como PNG con html-to-image.
// forwardRef para que el botón de compartir tome el nodo.
export const PasaporteCard = forwardRef<HTMLDivElement, { data: PasaporteData }>(
  function PasaporteCard({ data }, ref) {
    return (
      <div
        ref={ref}
        className="w-[360px] overflow-hidden rounded-artifact border border-white/10 bg-ink text-white shadow-[0_14px_36px_rgba(20,20,20,.28)]"
      >
        {/* Cubierta: la portada del pasaporte */}
        <div className="flex items-center justify-between border-b border-white/10 px-[18px] py-3.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">
            pasaporte de estilo
          </span>
          <span className="display text-base font-medium italic text-white">
            st<span className="text-white/55">ai</span>list
          </span>
        </div>

        {/* Hero: el avatar a todo lo ancho */}
        {data.heroImage ? (
          <div className="h-[200px] bg-white/[0.04]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.heroImage}
              alt=""
              className="h-full w-full object-cover object-[50%_10%]"
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-[18px] p-5">
          {/* Identidad */}
          <div>
            <div className="text-[11.5px] text-white/55">{data.name}</div>
            <div className="editorial text-[26px] leading-[1.08] text-white">
              {data.archetypeNombre ?? "tu estilo"}
            </div>
            {data.archetypeDesc ? (
              <div className="mt-1.5 text-[11.5px] leading-[1.4] text-white/55">
                {data.archetypeDesc}
              </div>
            ) : null}
          </div>

          {/* Tu paleta */}
          {data.swatches.length > 0 ? (
            <div className="flex flex-col gap-[11px] rounded-md border border-white/10 bg-white/[0.05] p-3.5">
              <div className="flex items-center justify-between">
                <span className={SECLBL}>
                  tu paleta{data.seasonLabel ? ` · ${data.seasonLabel}` : ""}
                </span>
                {data.metal ? (
                  <span className="flex items-center gap-1.5 rounded-sm border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                    <span
                      className="h-[11px] w-[11px] rounded-full"
                      style={{ backgroundColor: METAL_HEX[data.metal] }}
                    />
                    {data.metal === "oro" ? "oro" : "plata"}
                  </span>
                ) : null}
              </div>
              <div className="flex gap-1.5">
                {data.swatches.map((hex, i) => (
                  <span
                    key={i}
                    className="h-[38px] flex-1 rounded-sm border border-white/15"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {/* Colores que te encienden la cara */}
          {data.powerColors.length > 0 ? (
            <div className="flex flex-col gap-[9px]">
              <span className="text-[13px] leading-[1.4] text-white">
                tus colores que te{" "}
                <span className="editorial italic">encienden la cara</span>
              </span>
              <div className="flex flex-wrap gap-3.5">
                {data.powerColors.map((c) => (
                  <span key={c.hex + c.nombre} className="flex items-center gap-2">
                    <span
                      className="h-[18px] w-[18px] rounded-full border border-white/15"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span className="text-[11.5px] text-white/55">{c.nombre}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Tu metal */}
          {data.metal ? (
            <div className="flex flex-col gap-1.5">
              <span className={SECLBL}>tu metal · {data.metal}</span>
              <span className="text-[13px] leading-[1.4] text-white/85">
                {data.metal === "oro"
                  ? "el dorado te ilumina; la plata te apaga."
                  : "la plata te ilumina; el dorado te apaga."}
              </span>
            </div>
          ) : null}

          {/* Tu vibe */}
          {data.vibe.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className={SECLBL}>tu vibe</span>
              <div className="flex flex-wrap gap-1.5">
                {data.vibe.map((t) => (
                  <span
                    key={t}
                    className="rounded-sm border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs capitalize text-white"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Tu silueta */}
          {data.siluetaLine || data.favorece ? (
            <div className="flex flex-col gap-1.5">
              <span className={SECLBL}>
                tu silueta{data.siluetaLine ? ` · ${data.siluetaLine}` : ""}
              </span>
              {data.favorece ? (
                <span className="text-[13px] leading-[1.4] text-white/85">{data.favorece}</span>
              ) : null}
            </div>
          ) : null}

          {/* Tu fórmula que siempre jala */}
          {data.formula.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className={SECLBL}>tu fórmula que siempre jala</span>
              <div className="flex gap-2">
                {data.formula.map((p, i) => (
                  <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div className="aspect-[3/4] w-full overflow-hidden rounded-sm border border-white/10 bg-white/5">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <span className="w-full truncate text-center text-[9.5px] text-white/55">
                      {p.nombre}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-[10.5px] text-white/45">hecho con stailist</span>
            <span className="text-[11px] font-medium text-white/70">stailist.co</span>
          </div>
        </div>
      </div>
    );
  }
);
