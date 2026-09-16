"use client";

import { useFormStatus } from "react-dom";
import { OPCIONES_CONOCIO } from "@/lib/como-nos-conocio";
import { guardarComoNosConocio } from "./actions";

// Un toque = respuesta y avance: cada opción es un botón de envío con su valor,
// sin "seguir" aparte. Una pregunta de atribución que pide dos toques ya es
// fricción que no paga nada a la persona.
function Opcion({ id, label }: { id: string; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="como_nos_conocio"
      value={id}
      disabled={pending}
      className="flex min-h-[56px] w-full items-center border border-line bg-surface px-4 text-left text-[17px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function Saltar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="como_nos_conocio"
      value="omitido"
      disabled={pending}
      className="mt-1 self-center text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
    >
      prefiero no decir
    </button>
  );
}

export function ConocioPicker() {
  return (
    <form action={guardarComoNosConocio} className="flex flex-col gap-3">
      {OPCIONES_CONOCIO.map((o) => (
        <Opcion key={o.id} id={o.id} label={o.label} />
      ))}
      <Saltar />
    </form>
  );
}
