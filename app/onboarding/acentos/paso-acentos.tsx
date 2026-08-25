"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { AcentosGrid } from "@/components/acentos-grid";
import type { ApetitoAcentos } from "@/lib/looks";
import type { Gender } from "@/lib/auth";
import { guardarApetitoAcentos } from "@/app/perfil/actions";

// El grid + el avance. Elegir guarda con fuente 'elegido' (que es lo único que
// el motor escucha) y sigue al clóset; saltar deja la semilla y sigue igual.
//
// SIN AUTO-AVANCE AL TOCAR, a diferencia del deck de swipes: aquí las tres
// opciones se comparan entre sí, y avanzar al primer tap impediría cambiar de
// opinión viendo las otras dos. Se elige, se ve, y se confirma.
export function PasoAcentos({
  gender,
  inicial,
}: {
  gender: Gender;
  inicial: ApetitoAcentos | null;
}) {
  const router = useRouter();
  const [valor, setValor] = useState<ApetitoAcentos | null>(null);
  const [guardando, empezar] = useTransition();
  const [error, setError] = useState(false);

  // `inicial` es la SEMILLA de los swipes: no se pre-selecciona a propósito —
  // marcar una opción de entrada sesga la respuesta hacia ella, y justamente
  // esta pantalla existe porque esa derivación no es de fiar.
  void inicial;

  const seguir = () => {
    if (!valor) return;
    empezar(async () => {
      const r = await guardarApetitoAcentos(valor);
      if (!r.ok) {
        setError(true);
        return;
      }
      router.push("/onboarding/closet");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <AcentosGrid valor={valor} gender={gender} onPick={setValor} />

      {error ? (
        <p className="text-xs text-error">no se guardó — intenta de nuevo</p>
      ) : null}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={seguir}
          disabled={!valor || guardando}
          className="flex min-h-[54px] items-center justify-center gap-2 rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-40"
        >
          {guardando ? "guardando…" : "seguir"} <Icon name="flecha" size={19} />
        </button>
        <Link
          href="/onboarding/closet"
          className="text-center text-sm text-muted underline underline-offset-4"
        >
          mejor luego
        </Link>
      </div>
    </div>
  );
}
