"use client";

import { useEffect, useState } from "react";
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
      {/* NEGRA, como el pasaporte del perfil: no es una card más del montón,
          es una invitación. Tokens invertidos (bg-ink / text-bg), así que en
          modo oscuro también se lee al revés del resto. */}
      <div className="flex flex-col gap-3.5 rounded-md bg-ink p-5 text-bg">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] opacity-60">
          invitación · el círculo de stailist
        </p>
        <div className="flex flex-col gap-2">
          <p className="text-[19px] font-bold leading-tight tracking-[-0.01em]">
            Te elegí para el{" "}
            <em className="font-display font-normal italic tracking-normal">círculo</em>
          </p>
          <p className="text-[13.5px] leading-relaxed opacity-75">
            Es un grupo muy chico: las personas que más usan stailist. Quiero decidir con
            ustedes qué mejora en la app. Lo que me cuentes lo leo yo, y te escribo de vuelta.
            — Roberto
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEstado("escribiendo")}
            className="min-h-11 flex-1 rounded-sm bg-bg px-4 text-[14px] font-bold text-ink transition-opacity hover:opacity-90"
          >
            quiero opinar
          </button>
          <button
            type="button"
            onClick={() => {
              setEstado("fuera");
              void marcarInvitacion("descartada");
            }}
            className="min-h-11 px-4 text-[13px] font-semibold opacity-60 transition-opacity hover:opacity-100"
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
