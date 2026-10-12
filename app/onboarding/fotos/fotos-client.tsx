"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { ImportCarreteFlow, type AddFlowHandle, type PrendaGuardada } from "@/components/import-carrete-flow";
import { COLUMNA } from "../ancho";
import { terminarFotos } from "./actions";

/** Las fotos que se piden. Tres de outfits traen 9-12 prendas: lo que da la lista de básicos. */
export const FOTOS_QUE_SE_PIDEN = 3;

// La pantalla es el explainer, como "ahora, con tu ropa" (app/onboarding/
// tu-ropa): el carrete se abre directo con `elegir`, hasta 3 fotos. Se pide
// outfits y no prendas sueltas a propósito: una foto de un outfit saca 3 o 4
// prendas, y con tres fotos de prendas sueltas al motor no le alcanza. Al
// terminar, `terminarFotos` decide si sigue al objetivo o completa con la
// lista. La salida "no tengo fotos a la mano" es la lista de siempre: quien
// está en la calle o en la computadora no se queda atorado.
export function FotosClient({ userId }: { userId: string }) {
  const carrete = useRef<AddFlowHandle>(null);
  const [guardadas, setGuardadas] = useState<PrendaGuardada[] | null>(null);
  const [yendo, startTransition] = useTransition();

  const seguir = (prendas: PrendaGuardada[]) => {
    setGuardadas(prendas);
    startTransition(() => {
      void terminarFotos();
    });
  };

  return (
    <div className={`flex flex-1 flex-col justify-center gap-7 pb-10 ${COLUMNA}`}>
      <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-line text-ink">
        <Icon name="camara" size={18} />
      </span>
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">paso 3 de 5</p>
        <h1 className="text-[32px] font-bold leading-[1.02] tracking-[-0.025em] text-ink">
          tu primer look, con{" "}
          <em className="font-display font-normal italic tracking-normal">tu</em> ropa
        </h1>
        <p className="text-[18px] leading-snug text-muted">
          súbeme {FOTOS_QUE_SE_PIDEN} fotos de outfits que usas, de las que ya tienes en tu carrete:
          tú con la ropa puesta, o la ropa extendida. De ahí saco tus prendas y te armo el look.
        </p>
        <p className="text-sm leading-snug text-muted">
          nada entra a tu clóset sin que lo apruebes. si prefieres, empiezas con una lista de básicos.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => carrete.current?.elegir?.()}
          disabled={yendo}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:bg-accent-soft disabled:text-faint"
        >
          {yendo ? "armando tu clóset…" : `elegir ${FOTOS_QUE_SE_PIDEN} fotos`} <Icon name="chevron" size={17} />
        </button>
        <Link
          href="/onboarding/closet"
          className="flex min-h-11 items-center justify-center text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          no tengo fotos a la mano
        </Link>
      </div>

      <ImportCarreteFlow
        userId={userId}
        headless
        maxFotos={FOTOS_QUE_SE_PIDEN}
        ref={carrete}
        alTerminar={{
          label: guardadas ? "armando…" : "armar mi primer look",
          onClick: seguir,
        }}
      />
    </div>
  );
}
