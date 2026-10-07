"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Icon } from "@/components/icon";
import { ImportCarreteFlow, type AddFlowHandle } from "@/components/import-carrete-flow";
import { anclaParaPrimerLook, hrefLookConPrenda } from "@/lib/tu-ropa";
import { COLUMNA } from "../ancho";

// La pantalla es el explainer: por eso el carrete se abre directo (`elegir`),
// sin el "así funciona" de siempre, y con una sola foto. Al terminar no manda a
// "ver mi clóset" sino a un look armado con una de las prendas que acaban de
// entrar — la recompensa en el acto (lib/tu-ropa.ts).
export function TuRopaClient({ userId }: { userId: string }) {
  const carrete = useRef<AddFlowHandle>(null);
  const router = useRouter();

  return (
    <section className={`flex flex-1 flex-col justify-center gap-7 pb-10 ${COLUMNA}`}>
      <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-line text-ink">
        <Icon name="camara" size={18} />
      </span>
      <div className="flex flex-col gap-3">
        <h1 className="text-[32px] font-bold leading-[1.02] tracking-[-0.025em] text-ink">
          ahora, con{" "}
          <em className="font-display font-normal italic tracking-normal">tu</em> ropa
        </h1>
        <p className="text-[18px] leading-snug text-muted">
          sube una foto tuya de cuerpo entero, de las que ya tienes en tu carrete.
          saco las prendas que traes puestas y te armo un look con ellas.
        </p>
        <p className="text-sm leading-snug text-muted">
          es una sola foto, y nada entra a tu clóset sin que lo apruebes.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => carrete.current?.elegir?.()}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
        >
          elegir una foto <Icon name="chevron" size={17} />
        </button>
        <Link
          href="/hoy"
          className="flex min-h-11 items-center justify-center text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          ahora no
        </Link>
      </div>

      <ImportCarreteFlow
        userId={userId}
        headless
        unaFoto
        ref={carrete}
        alTerminar={{
          label: "armar un look con esto",
          onClick: (guardadas) => {
            const id = anclaParaPrimerLook(guardadas);
            router.push(id ? hrefLookConPrenda(id) : "/hoy");
          },
        }}
      />
    </section>
  );
}
