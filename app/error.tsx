"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";

// LA PANTALLA DE ERROR EN ESPAÑOL.
//
// Sin este archivo, cualquier excepción en render mostraba el cartel de fábrica
// de Next ("Application error: a client-side exception has occurred"), en
// inglés y sin salida. Y no es hipotético: next.config.ts documenta que
// <Image> LANZA en render cuando una URL no casa con localPatterns, tumbando la
// pantalla completa.
//
// El botón dice "vuelve a intentar" y no "recarga": reset() re-renderiza el
// segmento sin perder la navegación, y en la mayoría de los fallos transitorios
// (una URL firmada vencida, una imagen que no cargó) con eso basta.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // A la consola del navegador y a los logs de Vercel: sin esto el fallo se
    // pierde y sólo queda "algo se rompió" sin nada que investigar.
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center gap-8 bg-bg px-6 text-center">
      <Logo className="h-8" />
      <div className="flex flex-col gap-3">
        <h1 className="text-display font-semibold text-ink">
          Algo se me atoró.
        </h1>
        <p className="text-base text-muted">
          No es tu culpa. Dale otra vez y seguimos donde estábamos.
        </p>
      </div>
      <div className="flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={reset}
          className="flex min-h-12 w-full items-center justify-center rounded-sm bg-accent px-8 text-base font-bold text-on-accent transition-colors duration-200 hover:bg-accent-deep"
        >
          vuelve a intentar
        </button>
        <Link
          href="/hoy"
          className="min-h-11 text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          o vuelve al inicio
        </Link>
      </div>
    </div>
  );
}
