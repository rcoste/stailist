"use client";

import { useState, useTransition } from "react";
import { responderCorreoSemanal } from "@/app/perfil/actions";

// LA PREGUNTA DEL CORREO, UNA SOLA VEZ, EN EL HOME.
//
// Se pregunta después del primer 👍 —el pico emocional que ya usa el prompt de
// instalar la PWA— pero NO en el mismo momento ni como modal: dos prompts
// encima del look que acabas de aprobar es exactamente la sensación de "ya me
// están vendiendo". Vive como una card del home, la ve al volver, y cualquiera
// de las dos respuestas la retira para siempre (journey_state.correo_preguntado).
//
// Sin esto, con el default en 'off' (migración 0153) nadie se enteraría de que
// el correo semanal existe.
export function CorreoOptInCard() {
  const [estado, setEstado] = useState<"pregunta" | "si" | "no" | "oculta">("pregunta");
  const [pending, start] = useTransition();

  function responder(quiere: boolean) {
    setEstado(quiere ? "si" : "no");
    start(async () => {
      await responderCorreoSemanal(quiere);
      setTimeout(() => setEstado("oculta"), 1800);
    });
  }

  if (estado === "oculta") return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {estado === "pregunta" ? (
        <>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              una pregunta
            </span>
            <b className="text-[15px] font-semibold text-ink">
              ¿te mando un look cada lunes al correo?
            </b>
            <span className="text-sm text-muted">
              uno a la semana, con tu ropa y el clima. se apaga con un clic.
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => responder(true)}
              className="flex min-h-11 flex-1 items-center justify-center rounded-sm bg-accent text-sm font-bold text-on-accent transition-colors hover:bg-accent-deep"
            >
              sí, quiero
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => responder(false)}
              className="flex min-h-11 flex-1 items-center justify-center rounded-sm border border-line bg-surface text-sm font-medium text-ink transition-colors hover:border-ink"
            >
              ahora no
            </button>
          </div>
        </>
      ) : (
        <span className="text-sm text-ink">
          {estado === "si"
            ? "va — el próximo lunes te llega el primero."
            : "listo, no te escribo. si cambias de idea está en tu perfil."}
        </span>
      )}
    </div>
  );
}
