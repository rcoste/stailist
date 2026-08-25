"use client";

import { useState, useTransition } from "react";
import type { ApetitoAcentos } from "@/lib/looks";
import type { Gender } from "@/lib/auth";
import { AcentosGrid } from "@/components/acentos-grid";
import { guardarApetitoAcentos } from "@/app/perfil/actions";

// EL APETITO DE ACENTOS, en el perfil. La dimensión de intake de stylist que
// faltaba: cuánta atención quieres que atraiga tu ropa — independiente de la
// colorimetría (QUÉ colores te van) y del arquetipo (qué vibe eres).
// Marco: docs/designs/acentos-y-colorimetria-por-zona.md.
//
// El grid vive en AcentosGrid, compartido con el paso del onboarding: las dos
// puertas tienen que medir lo mismo.
//
// Se guarda al tocar, sin botón (patrón de RegistroPlanCard), y elegir escribe
// fuente 'elegido': la semilla derivada de los swipes no vuelve a pisarlo, y es
// SÓLO con 'elegido' que el motor lo escucha (lib/engine/contexto.ts).

export function AcentosCard({
  inicial,
  fuente,
  gender,
}: {
  inicial: ApetitoAcentos | null;
  /** 'swipes' = semilla derivada (se pide confirmar); 'elegido' = ya lo dijo. */
  fuente: string | null;
  gender: Gender | null;
}) {
  const [valor, setValor] = useState<ApetitoAcentos | null>(inicial);
  const [confirmado, setConfirmado] = useState(fuente === "elegido");
  const [, empezar] = useTransition();
  const [error, setError] = useState(false);

  const tocar = (nivel: ApetitoAcentos) => {
    setValor(nivel);
    setConfirmado(true);
    empezar(async () => {
      const r = await guardarApetitoAcentos(nivel);
      setError(!r.ok);
    });
  };

  return (
    <div className="flex flex-col gap-3 border-t border-line p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Cuánto color te late
        </span>
        <span className="text-xs text-muted">
          {confirmado
            ? "Esto le dice a tus looks cuánto color meter — y dónde."
            : "Esto lo deduje de tus swipes. Dime cuál te pondrías tú y lo dejo bien."}
        </span>
      </div>
      {error ? <p className="text-xs text-error">no se guardó — intenta de nuevo</p> : null}
      <AcentosGrid valor={valor} gender={gender} onPick={tocar} />
    </div>
  );
}
