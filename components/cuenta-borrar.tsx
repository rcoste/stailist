"use client";

import { useState, useTransition } from "react";
import { borrarMiCuenta } from "@/app/perfil/actions";

// Perfil › cuenta: borrar la cuenta entera. Dos pasos a propósito —abrir y
// escribir "borrar"— porque no hay vuelta atrás y un tap accidental aquí
// cuesta un clóset entero. Sin modal: se despliega en la misma fila, en gris,
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
            se borra todo: tus fotos, tu avatar, tus prendas, tus looks, tus
            viajes y tu correo. no hay papelera. para confirmar, escribe{" "}
            <b>borrar</b>.
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
            {pending ? "borrando…" : "sí, borrar mi cuenta"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
