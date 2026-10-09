"use client";

import { useEffect, useState, type ReactNode } from "react";

// EL BOTÓN AVISA QUE YA LO TOCASTE (2026-10-09).
//
// El formulario sigue siendo un POST nativo a /empezar (el porqué está en
// entrar-boton.tsx), pero el botón no daba ninguna señal mientras cargaba. Con
// una conexión lenta (7 s en vez del ~1 s normal), una persona de Colombia lo
// tocó 13 veces en 20 segundos: cada toque cancelaba el anterior y abría un
// borrador nuevo, 12 cuentas vacías. Ahora al primer toque dice "Abriendo…" y
// no acepta otro.
//
// `pageshow` con `persisted`: si vuelve con el botón de atrás, el navegador
// restaura la página congelada tal como la dejó —con el botón apagado—, así
// que hay que reactivarlo a mano.
export function FormEmpezar({
  formClassName,
  buttonClassName,
  children,
}: {
  formClassName?: string;
  buttonClassName?: string;
  children: ReactNode;
}) {
  const [abriendo, setAbriendo] = useState(false);

  useEffect(() => {
    const alVolver = (e: PageTransitionEvent) => {
      if (e.persisted) setAbriendo(false);
    };
    window.addEventListener("pageshow", alVolver);
    return () => window.removeEventListener("pageshow", alVolver);
  }, []);

  return (
    <form
      method="post"
      action="/empezar"
      className={formClassName}
      onSubmit={(e) => {
        if (abriendo) {
          e.preventDefault();
          return;
        }
        setAbriendo(true);
      }}
    >
      <button type="submit" disabled={abriendo} aria-busy={abriendo} className={buttonClassName}>
        {abriendo ? "Abriendo…" : children}
      </button>
    </form>
  );
}
