"use client";

import { useState, useTransition } from "react";
import { Icon, type IconName } from "@/components/icon";
import { markIntroSeen } from "@/lib/intros";

// La primera vez que entras a "tus esenciales": qué es la idea y por qué
// funciona. Se muestra UNA vez.
//
// Por qué existe (pedido de Roberto tras el feedback de Alberto): quitamos la
// palabra "cápsula" de la interfaz porque es jerga de moda y la voz del producto
// la prohíbe — pero la IDEA detrás sí vale la pena, y sin ella la pantalla se
// lee como "una lista de compras que la app se inventó". El término de oficio
// vuelve aquí una sola vez, como CREDENCIAL ("no es invento nuestro") y no como
// el nombre que la persona tiene que aprender para usar la app.
//
// Sigue el patrón de la intro de colorimetría: ENSEÑAR, no explicar. La
// multiplicación de abajo ES el argumento; el texto solo la acompaña.

// Las dos filas de la demostración. Los iconos son los del sistema — nada de
// ilustraciones nuevas: lo que comunica es la operación, no el dibujo.
//
// La percha en AMBAS filas, y no camisa arriba: para la fila de abajo no hay
// glifo de pantalón, así que camisa arriba + percha abajo rompería la simetría
// de la multiplicación (una fila con prenda concreta y la otra con el genérico).
// La percha es la marca genérica de "prenda" que ya usa toda la app, y quien
// diferencia las filas es el rótulo, no el dibujo.
const ARRIBA: IconName[] = ["gancho", "gancho", "gancho"];
const ABAJO: IconName[] = ["gancho", "gancho", "gancho"];

export function EsencialesIntro({
  total,
  onListo,
}: {
  /** Cuántas piezas tiene su lista, para que el cierre hable de LO SUYO. */
  total: number;
  onListo: () => void;
}) {
  const [, start] = useTransition();

  return (
    <section className="flex flex-1 flex-col gap-6 pb-4 lg:mx-auto lg:max-w-[560px]">
      <div className="flex flex-col gap-2.5">
        <h1 className="text-[30px] font-bold leading-[1.06] tracking-[-0.025em] text-ink lg:text-[38px]">
          Pocas piezas.
          <br />
          Muchos looks.
        </h1>
        <p className="display text-[19px] italic leading-[26px] text-muted">
          No se trata de tener más ropa — se trata de que la que tengas combine
          entre sí.
        </p>
      </div>

      {/* La demostración: la multiplicación. Es todo el argumento en una imagen
          — seis prendas dan nueve maneras de vestirte.
          Cada fila lleva su ETIQUETA y no depende de que el icono se lea: si el
          dibujo tiene que cargar solo con el significado, el argumento se cae. */}
      <div className="my-auto flex flex-col items-center gap-2.5 border border-line bg-surface px-4 py-7">
        <Fila iconos={ARRIBA} rotulo="3 de arriba" />
        <Operador signo="×" />
        <Fila iconos={ABAJO} rotulo="3 de abajo" />
        <Operador signo="=" />
        <p className="display text-[34px] italic leading-none text-ink">
          9 looks
        </p>
        <p className="text-[12.5px] text-muted">con solo 6 prendas</p>
      </div>

      <div className="flex flex-col gap-3">
        {/* La credencial, una sola vez y en letra chica: da respaldo sin
            obligar a nadie a aprenderse el término. */}
        <p className="flex items-start gap-2 text-[12.5px] leading-snug text-muted">
          <Icon name="libro" size={14} className="mt-px shrink-0" />
          <span>
            No es invento nuestro: los estilistas llevan desde los setenta
            armando así los clósets. Le dicen{" "}
            <b className="font-semibold text-ink2">clóset cápsula</b>.
          </span>
        </p>
        <p className="text-[14px] leading-relaxed text-ink2">
          Te armé {total > 0 ? `las ${total} piezas` : "la lista"} que TU vida
          pide — por tu trabajo, tu clima y tus colores. Ahora te digo cuáles ya
          tienes, cuáles te faltan y cuántos looks desbloquea cada una.
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          // Optimista: la lista aparece al instante y el guardado va detrás.
          // Si el guardado falla, lo peor que pasa es volver a ver la intro.
          onListo();
          start(async () => {
            await markIntroSeen("esenciales");
          });
        }}
        className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
      >
        ver mis esenciales <Icon name="chevron" size={17} />
      </button>
    </section>
  );
}

function Fila({ iconos, rotulo }: { iconos: IconName[]; rotulo: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex gap-2">
        {iconos.map((n, i) => (
          <span
            key={i}
            className="flex h-[62px] w-[62px] items-center justify-center border border-line bg-tile text-ink/30"
          >
            <Icon name={n} size={30} />
          </span>
        ))}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
        {rotulo}
      </span>
    </div>
  );
}

function Operador({ signo }: { signo: string }) {
  return (
    <span aria-hidden className="text-[15px] font-bold leading-none text-faint">
      {signo}
    </span>
  );
}

/**
 * Decide si toca enseñar la intro. El estado vive aquí (cliente) para que al
 * cerrarla la lista aparezca en el mismo frame, sin esperar al server.
 */
export function EsencialesGate({
  vista,
  total,
  children,
}: {
  vista: boolean;
  total: number;
  children: React.ReactNode;
}) {
  const [cerrada, setCerrada] = useState(false);
  if (vista || cerrada) return <>{children}</>;
  return <EsencialesIntro total={total} onListo={() => setCerrada(true)} />;
}
