"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { BuzonEnHoja } from "@/components/boton-reportar";
import { marcarInvitacion } from "@/lib/invitacion-opinion";

// LA INVITACIÓN A OPINAR, arriba de Inicio (2026-11-13). Sólo la ven las
// personas que Roberto invitó (tabla invitaciones_opinion, migración 0190): las
// que más usan la app. Pide lo que una entrevista pediría —qué te gusta, qué
// no, qué falta— sin que tengan que salir de la app ni abrir el correo.
//
// FIRMADA POR ROBERTO, a propósito: "nos interesa tu opinión" de una marca se
// ignora; de la persona que hace la app, se contesta.
//
// "AHORA NO" ES PARA SIEMPRE. A quien más usa la app no se le insiste: una
// tarjeta que vuelve después de que dijiste que no se siente a cobranza.
export function InvitacionOpinion() {
  const [estado, setEstado] = useState<"visible" | "escribiendo" | "fuera">("visible");
  const [respondida, setRespondida] = useState(false);

  useEffect(() => {
    void marcarInvitacion("vista");
  }, []);

  if (estado === "fuera") return null;

  return (
    <>
      <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon name="corazon" size={16} />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-[15px] font-bold leading-snug text-ink">
              Eres de las personas que más usa stailist
            </p>
            <p className="text-[13.5px] leading-relaxed text-muted">
              Por eso tu opinión vale doble. ¿Qué te gusta, qué no y qué te gustaría que hiciera? Lo leo
              yo, en serio. — Roberto
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEstado("escribiendo")}
            className="min-h-11 flex-1 rounded-sm bg-accent px-4 text-[14px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
          >
            te cuento
          </button>
          <button
            type="button"
            onClick={() => {
              setEstado("fuera");
              void marcarInvitacion("descartada");
            }}
            className="min-h-11 px-4 text-[13px] font-semibold text-muted transition-colors hover:text-ink"
          >
            ahora no
          </button>
        </div>
      </div>
      {estado === "escribiendo" ? (
        <BuzonEnHoja
          opinion
          // Si ya contestó, al cerrar el acuse ("llegó") la tarjeta se va; si
          // cerró sin mandar, sigue ahí para cuando quiera.
          onClose={() => setEstado(respondida ? "fuera" : "visible")}
          onEnviado={() => {
            setRespondida(true);
            void marcarInvitacion("respondida");
          }}
        />
      ) : null}
    </>
  );
}
