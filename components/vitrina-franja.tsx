"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { registrarTiendaClick, registrarVitrinaVista, type DesdeVitrina } from "@/lib/vitrina-actions";
import { fechaCorta, type PrendaVitrina } from "@/lib/vitrina-uniqlo";

// LA FRANJA DE PRENDAS REALES bajo una pieza que te falta (2026-10-20).
// Hasta dos prendas de Uniqlo del país de destino, en tu color, con precio y
// enlace a la ficha. Es la prueba de docs/designs/vitrina-de-tienda.md: si con
// la prenda real enfrente alguien compra. Dos eventos, nada más: que se pintó
// (al montar, una vez) y que se tocó el enlace.
//
// La foto va por next/image (D2): el host image.uniqlo.com está en
// next.config.ts y `fotoSegura` ya filtró cualquier otro antes de llegar aquí.
export function VitrinaFranja({
  prendas,
  clave,
  desde,
}: {
  prendas: PrendaVitrina[];
  clave: string;
  desde: DesdeVitrina;
}) {
  const registrada = useRef(false);
  useEffect(() => {
    if (registrada.current || prendas.length === 0) return;
    registrada.current = true;
    // En modo "ver como" el servidor contesta 403 a cualquier POST (es de sólo
    // lectura): la medición se pierde a propósito y no puede ensuciar la consola.
    registrarVitrinaVista(clave, prendas.map((p) => p.id), prendas[0].tienda, desde).catch(() => {});
  }, [prendas, clave, desde]);

  if (prendas.length === 0) return null;
  const tienda = prendas[0].tienda;
  const visto = fechaCorta(prendas[0].vistoEl);

  return (
    <div className="border-t border-line2 px-[13px] pb-3 pt-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[9.5px] font-bold uppercase tracking-[0.13em] text-faint">
          la hay en {tienda}
        </span>
        {visto ? <span className="shrink-0 text-[10px] text-faint">visto el {visto}</span> : null}
      </div>
      <ul className="mt-2 flex flex-col gap-2">
        {prendas.map((p) => (
          <li key={p.id}>
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => registrarTiendaClick(clave, p.id, p.tienda, desde).catch(() => {})}
              className="flex items-center gap-3"
            >
              <span className="relative block aspect-[4/5] w-[44px] shrink-0 overflow-hidden bg-tile">
                <Image src={p.foto} alt={p.nombre} fill sizes="44px" className="object-cover" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-bold text-ink">{p.nombre}</span>
                <span className="tabular text-[12px] text-muted">
                  {p.precioTexto} · {p.color.toLowerCase()}
                </span>
              </span>
              <span className="shrink-0 text-[12px] font-bold underline underline-offset-2 text-ink">verla</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
