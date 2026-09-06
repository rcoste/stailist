"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { responderCorreoSemanal } from "@/app/perfil/actions";

// Perfil › cuenta: el interruptor del correo semanal. Es lo que hace que el
// opt-in sea reversible en los dos sentidos sin buscar el link de baja en un
// correo viejo. Sin contador ni argumento de venta: una frase y un switch.
export function CorreoSemanalToggle({ inicial }: { inicial: "semanal" | "off" }) {
  const [activo, setActivo] = useState(inicial === "semanal");
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  function cambiar() {
    const siguiente = !activo;
    setActivo(siguiente);
    setError(false);
    start(async () => {
      const r = await responderCorreoSemanal(siguiente);
      if (!r.ok) {
        setActivo(!siguiente);
        setError(true);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={cambiar}
      disabled={pending}
      aria-pressed={activo}
      className="flex w-full items-center gap-3 rounded-md border border-line bg-surface p-4 text-left transition-colors hover:border-accent disabled:opacity-60"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon name="sobre" size={16} />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-ink">un look cada lunes, al correo</span>
        <span className="text-xs text-muted">
          {error
            ? "no se guardó — inténtalo de nuevo."
            : activo
              ? "activado. lo apagas aquí cuando quieras."
              : "apagado. actívalo y te llega uno a la semana."}
        </span>
      </div>
      <span
        aria-hidden
        className={`ml-auto flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          activo ? "bg-accent" : "bg-line"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-surface transition-transform ${
            activo ? "translate-x-5" : ""
          }`}
        />
      </span>
    </button>
  );
}
