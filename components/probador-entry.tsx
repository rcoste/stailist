"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { Probador, type PrendaProbador } from "@/components/probador";

// LA PUERTA DEL PROBADOR DESDE EL CLÓSET.
//
// El probador existía desde la Fase 3c de Cartera y funcionaba bien, pero sólo
// se llegaba desde la wishlist: Clóset → pestaña wishlist → bajar → botón. Y la
// wishlist es donde guardas lo que NO tienes, así que alguien que quisiera
// combinar su propia ropa no iba a buscar ahí jamás. La función estaba
// catalogada como "algo de la wishlist" cuando en realidad sirve igual —o más—
// con puras prendas tuyas.
//
// Dos entradas, y ninguna es redundante con la otra porque nacen de intenciones
// distintas: en el clóset estás mirando tu ropa y quieres jugar; en la wishlist
// estás decidiendo una compra. La misma pantalla contesta las dos.
//
// SÓLO CON 2 O MÁS PRENDAS. Con una, "pruébate un look" no significa nada
// —saldrías en puro saco— y ofrecerlo sería prometer algo que la pantalla no
// puede cumplir. El clóset arranca con básicos del catálogo, así que en la
// práctica siempre está; el gate es para el clóset recién nacido.
export function ProbadorEntry({
  closet,
  wishlist,
}: {
  closet: PrendaProbador[];
  wishlist: PrendaProbador[];
}) {
  const [abierto, setAbierto] = useState(false);
  if (closet.length + wishlist.length < 2) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center gap-3 rounded-md border border-line bg-surface px-3.5 py-[11px] text-left transition-colors hover:border-ink"
      >
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md bg-tile text-ink">
          <Icon name="repetir" size={18} />
        </span>
        <span className="flex min-w-0 flex-col">
          <b className="text-[14.5px] font-bold text-ink">pruébate un look</b>
          <span className="text-[12.5px] text-muted">
            combina prendas y mírate con ellas
          </span>
        </span>
        <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
      </button>

      {abierto ? (
        <Probador
          closet={closet}
          wishlist={wishlist}
          onClose={() => setAbierto(false)}
        />
      ) : null}
    </>
  );
}
