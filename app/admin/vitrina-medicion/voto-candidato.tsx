"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { votarCandidato } from "./actions";

// Sí / no por candidato. Optimista: el botón se pinta al tocarlo y la base se
// entera después; tocar el mismo otra vez quita el voto.
export function VotoCandidato({ id, voto }: { id: string; voto: boolean | null }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [optimista, setOptimista] = useOptimistic(voto);

  const marcar = (v: boolean) => {
    const nuevo = optimista === v ? null : v;
    start(async () => {
      setOptimista(nuevo);
      await votarCandidato(id, nuevo === null ? "quitar" : nuevo ? "si" : "no");
      router.refresh();
    });
  };

  const boton = (v: boolean, label: string) => {
    const activo = optimista === v;
    const tono = v ? "border-success bg-success text-on-accent" : "border-error bg-error text-on-accent";
    return (
      <button
        type="button"
        onClick={() => marcar(v)}
        disabled={pendiente}
        className={`h-8 flex-1 rounded-sm border text-sm font-semibold transition-colors duration-200 disabled:opacity-60 ${
          activo ? tono : "border-line bg-surface text-ink2 hover:border-ink hover:text-ink"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex gap-2">
      {boton(true, "sí")}
      {boton(false, "no")}
    </div>
  );
}
