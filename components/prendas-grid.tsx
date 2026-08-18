"use client";

import Image from "next/image";
import Link from "next/link";
import type { TryonPrenda } from "@/components/tryon-view";

// Retícula de prendas del detalle del look — COMPARTIDA por Hoy/wow e Historial
// (vivía duplicada en los dos y las copias divergieron: el refactor de "cabe sin
// scroll" tiró la regla de 5+ en una pasada — este archivo es el candado).
//
// Reglas (v1 §4, ratificadas por el handoff v2):
// - ≤4 prendas → 2 columnas parejas.
// - 5+ → 2 PROTAGONISTAS arriba (2 columnas) + fila de apoyo con tantas columnas
//   como prendas (tope 4), alineada a la izquierda. Sin esto, la 5ª prenda queda
//   sola con un hueco muerto al lado.
// - Alturas flexibles (60/40): la retícula llena el alto disponible y se encoge
//   en pantallas cortas — decisión de Roberto: todo cabe sin scroll.

// El tile ABRE LA FICHA de la prenda, que es lo que Roberto esperaba al tocarlo
// ("no puedo ver el detalle de la prenda al picarle a alguno de los
// thumbnails"). No estaba roto: nunca se construyó — la retícula pintaba divs y
// el tipo ni siquiera cargaba el id.
//
// LLEVA AL CLÓSET Y NO ABRE UNA HOJA AQUÍ, y es a propósito: la ficha de una
// prenda ya existe, con sus chips de edición y su borrado, dentro de
// closet-grid. Duplicarla aquí sería la tercera copia de un vocabulario que
// este repo ya tuvo que unificar una vez. El clóset la abre solo al recibir
// `?prenda=<id>`.
//
// Sin id (comparador, evales, clósets ajenos) el tile sigue siendo un div, como
// era antes: no hay ficha que abrir.
function Tile({ prenda }: { prenda: TryonPrenda }) {
  const cuerpo = (
    <>
      {prenda.imagen ? (
        <Image
          src={prenda.imagen}
          alt={prenda.nombre}
          fill
          sizes="(max-width: 430px) 50vw, 200px"
          className="object-cover"
        />
      ) : (
        <span
          className="absolute inset-0"
          style={{ backgroundColor: prenda.swatch }}
          aria-hidden
        />
      )}
      {/* Nombre sobre la foto: scrim + una línea con ellipsis (title = completo). */}
      <span
        title={prenda.nombre}
        className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/[0.62] via-black/[0.34] to-transparent px-2.5 pb-[7px] pt-4 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-white"
      >
        {prenda.nombre}
      </span>
    </>
  );

  const marco =
    "relative block h-full w-full overflow-hidden rounded-sm border border-line bg-tile";
  if (!prenda.id) return <div className={marco}>{cuerpo}</div>;
  return (
    <Link
      href={`/closet?prenda=${prenda.id}`}
      aria-label={`ver ${prenda.nombre} en tu clóset`}
      className={`${marco} transition-opacity active:opacity-80`}
    >
      {cuerpo}
    </Link>
  );
}

export function PrendasGrid({ prendas }: { prendas: TryonPrenda[] }) {
  const n = prendas.length;
  if (n <= 4) {
    return (
      <div className="grid h-full min-h-0 grid-cols-2 gap-2 [grid-auto-rows:minmax(0,1fr)]">
        {prendas.map((p, i) => (
          <Tile key={i} prenda={p} />
        ))}
      </div>
    );
  }
  const protag = prendas.slice(0, 2);
  const support = prendas.slice(2);
  const cols = Math.min(support.length, 4);
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="grid min-h-0 flex-[3] grid-cols-2 gap-2 [grid-auto-rows:minmax(0,1fr)]">
        {protag.map((p, i) => (
          <Tile key={i} prenda={p} />
        ))}
      </div>
      <div
        className="grid min-h-0 flex-[2] gap-2 [grid-auto-rows:minmax(0,1fr)]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      >
        {support.map((p, i) => (
          <Tile key={i} prenda={p} />
        ))}
      </div>
    </div>
  );
}
