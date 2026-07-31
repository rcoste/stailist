"use client";

import Link from "next/link";

// Toast transitorio compartido (esenciales + viaje): confirma una acción sin
// robar foco. Va al CENTRO de la pantalla para que no se pierda ni choque con el
// FAB; entra con fade + escala. El caller controla su vida (~2.2s y luego lo
// limpia).
//
// `accion` le añade una salida al sitio donde acaba de quedar la cosa. Nace del
// feedback de Alberto sobre el corazón: guardaba un look, el corazón se llenaba
// y ahí terminaba todo. El sitio SÍ existía (el filtro "favoritos" del
// Historial), pero nada se lo decía ni lo llevaba — así que para él la acción se
// evaporaba. Un acuse que no dice dónde quedó la cosa está a medias.
export function Toast({
  message,
  accion,
}: {
  message: string | null;
  accion?: { label: string; href: string } | null;
}) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-10"
    >
      <div className="toast-pop flex items-center gap-3 rounded-md bg-ink px-5 py-3 text-center text-sm font-medium text-on-accent shadow-[0_10px_30px_rgba(20,20,20,.25)]">
        <span>{message}</span>
        {accion ? (
          // El contenedor es pointer-events-none para no bloquear la pantalla;
          // el enlace se los devuelve para poder tocarlo.
          <Link
            href={accion.href}
            // -my-3/py-3 llevan el área táctil a 44px sin engordar la píldora.
            className="pointer-events-auto -my-3 shrink-0 py-3 text-sm font-bold text-on-accent underline underline-offset-[3px]"
          >
            {accion.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
