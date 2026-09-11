"use client";

import { useState, useTransition } from "react";
import { borrarMiCuenta } from "@/app/perfil/actions";
import { DIAS_PARA_BORRAR } from "@/lib/borrado-programado";

// Perfil › cuenta: borrar la cuenta entera. Dos pasos a propósito —abrir y
// escribir "borrar"— porque un tap accidental aquí cuesta un clóset entero. Y
// desde el 2026-09-10 no borra en el acto: programa el borrado a 30 días
// (lib/borrado-programado.ts), para que arrepentirse sea posible. Sin modal: se despliega en la misma fila, en gris,
// al final de la pestaña, donde nadie llega por accidente.
export function CuentaBorrar() {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function borrar() {
    setMsg(null);
    start(async () => {
      const r = await borrarMiCuenta(texto);
      // Si la acción devuelve, es que NO borró (borrar redirige y no vuelve).
      if (r && !r.ok) setMsg(r.mensaje);
    });
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="min-h-11 text-sm font-medium text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
      >
        borrar mi cuenta
      </button>

      {abierto ? (
        <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
          <p className="text-sm leading-snug text-ink">
            tu cuenta se desactiva hoy y se borra por completo en{" "}
            {DIAS_PARA_BORRAR} días: tus fotos, tu avatar, tus prendas, tus
            looks, tus viajes y tu correo. si cambias de opinión, entra antes y
            la recuperas. para confirmar, escribe <b>borrar</b>.
          </p>
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="borrar"
            autoComplete="off"
            className="min-h-11 rounded-sm border border-line bg-bg px-3 text-sm text-ink"
          />
          {msg ? <p className="text-sm text-error">{msg}</p> : null}
          <button
            type="button"
            onClick={borrar}
            disabled={pending || texto.trim().toLowerCase() !== "borrar"}
            className="flex min-h-11 w-full items-center justify-center rounded-sm border border-error bg-surface text-sm font-bold text-error transition-colors hover:bg-error hover:text-on-accent disabled:opacity-40"
          >
            {pending ? "programando…" : "sí, borrar mi cuenta"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
