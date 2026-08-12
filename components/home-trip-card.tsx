"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { imagenDestino } from "@/lib/destino-imagen";
import { VENTANA_VIAJE_DIAS } from "@/lib/trip";
import type { HomeTrip } from "@/lib/home-trip";

// La card de viaje del home — SOLO aparece a ≤7 días (lib/home-trip decide).
// Dos estados según la maleta: "arma la maleta →" y "maleta lista — te faltan
// N artículos".
//
// La foto es de un set fijo en blanco y negro (public/destinos), elegida por
// nombre del lugar con fallback a las ocasiones del viaje — ver
// lib/destino-imagen. NO es una foto del viaje real (trips no guarda ninguna) y
// por eso va en B&N editorial: a color y fotorrealista fingiría ser tu Cancún y
// se leería como stock de agencia.
export function HomeTripCard({ trip }: { trip: HomeTrip }) {
  // LOS DÍAS SE CUENTAN CON EL RELOJ DEL TELÉFONO, no con el del server.
  // El server corre en UTC: a las 18:00 de CDMX allá ya es mañana, así que un
  // viaje que sale mañana llegaba como `dias: 0` y la card anunciaba "viaje ·
  // en curso" — y el plazo de compra decía "consíguelos hoy" a las 8 de la
  // noche del día anterior. El server manda su cuenta como punto de partida
  // (con un día de colchón en la consulta) y aquí se corrige tras montar.
  const [dias, setDias] = useState(trip.dias);
  useEffect(() => {
    setDias(diasLocalesHasta(trip.fechaInicio));
  }, [trip.fechaInicio]);

  // Fuera de la ventana con la fecha REAL del dispositivo: el colchón del
  // server dejó pasar un viaje que aquí todavía no toca anunciar.
  if (dias > VENTANA_VIAJE_DIAS) return null;

  const eyebrow =
    dias <= 0
      ? "viaje · en curso"
      : dias === 1
        ? "viaje · mañana"
        : `viaje · en ${dias} días`;

  const detalle = trip.maletaLista
    ? trip.faltan > 0
      ? `maleta lista — te ${trip.faltan === 1 ? "falta 1 artículo" : `faltan ${trip.faltan} artículos`}`
      : "maleta lista — todo cubierto"
    : null;

  const accion = !trip.maletaLista
    ? "arma la maleta"
    : trip.faltan > 0
      ? `${trip.faltan === 1 ? "consíguelo" : "consíguelos"} ${plazoCompra(dias, trip.fechaInicio)}`
      : "ver tu maleta";

  return (
    <Link
      href={trip.href}
      className="flex min-h-[118px] w-full overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-ink"
    >
      <span className="relative w-[118px] shrink-0 bg-tile">
        <Image
          src={imagenDestino(trip.lugar, trip.ocasiones)}
          alt=""
          fill
          sizes="130px"
          className="object-cover"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-faint">
          {eyebrow}
        </span>
        <span className="mt-0.5 text-[15px] font-bold leading-tight text-ink">
          tu viaje a{" "}
          <em className="font-display text-[27px] font-normal italic tracking-normal">
            {trip.lugar}
          </em>
        </span>
        {detalle ? (
          <span className="mt-0.5 text-[12.5px] leading-snug text-muted">{detalle}</span>
        ) : null}
        {/* La flecha va pegada con nbsp: "consíguelos antes del viernes" no cabe
            en una línea a este ancho, y sin esto la flecha caía sola en la
            segunda — se lee como un renglón roto, no como un botón. */}
        <span className="mt-1.5 text-[13px] font-bold leading-snug text-ink">
          {accion}
          {" →"}
        </span>
      </span>
    </Link>
  );
}

// Días entre HOY (el de este dispositivo) y una fecha YYYY-MM-DD. Se compara
// fecha contra fecha, sin horas: lo que importa es cuántos amaneceres faltan.
function diasLocalesHasta(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  const destino = new Date(y, m - 1, d);
  const hoy = new Date();
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((destino.getTime() - hoySinHora.getTime()) / 86_400_000);
}

// "antes del jueves" / "hoy" / "mañana" — el plazo para conseguir lo que falta.
// Si el viaje ya empezó o es hoy, "antes del <día>" sonaría a regaño imposible.
function plazoCompra(dias: number, fechaInicio: string): string {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "hoy — sales mañana";
  const [y, m, d] = fechaInicio.split("-").map(Number);
  const dia = new Date(y, m - 1, d).toLocaleDateString("es-MX", { weekday: "long" });
  return `antes del ${dia}`;
}
