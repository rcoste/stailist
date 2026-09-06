"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { AGE_RANGES, ageLabel, isMinor, type AgeRange } from "@/lib/edad";
import { cambiarEdad } from "@/app/perfil/actions";

// Perfil › cuenta: corregir el rango de edad. Cerrado por default (una fila
// con el valor y "cambiar"); al abrir, los seis rangos y —si elige 13-17— el
// correo del tutor, con la misma explicación que en el onboarding.
export function EdadEditar({ inicial }: { inicial: AgeRange | null }) {
  const [abierto, setAbierto] = useState(false);
  const [rango, setRango] = useState<AgeRange | null>(inicial);
  const [tutor, setTutor] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const menor = isMinor(rango);

  function guardar() {
    if (!rango) return;
    setMsg(null);
    start(async () => {
      const r = await cambiarEdad(rango, menor ? tutor : null);
      if (!r.ok) {
        setMsg(r.mensaje ?? "no se guardó — inténtalo de nuevo.");
        return;
      }
      setMsg(menor ? "guardado. le mandé el link de permiso a tu tutor." : "guardado.");
      setAbierto(false);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon name="persona" size={16} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-medium text-ink">
            tu edad · {ageLabel(inicial) ?? "sin poner"}
          </span>
          <span className="text-xs text-muted">
            {msg ?? "solo el rango; ayuda a acertarle a tu estilo."}
          </span>
        </div>
        <span className="ml-auto shrink-0 text-xs font-semibold text-muted">
          {abierto ? "cerrar" : "cambiar"}
        </span>
      </button>

      {abierto ? (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <div className="grid grid-cols-3 gap-2">
            {AGE_RANGES.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setRango(o.id)}
                className={`min-h-11 rounded-sm border text-sm font-medium transition-colors ${
                  rango === o.id
                    ? "border-accent bg-accent text-on-accent"
                    : "border-line bg-bg text-ink hover:border-ink"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {menor ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs leading-snug text-muted">
                con 13-17 necesitamos el permiso de tu papá, mamá o tutor para
                que subas fotos. le mando un link a este correo:
              </p>
              <input
                type="email"
                value={tutor}
                onChange={(e) => setTutor(e.target.value)}
                placeholder="correo de tu tutor"
                className="min-h-11 rounded-sm border border-line bg-bg px-3 text-sm text-ink"
              />
            </div>
          ) : null}
          <button
            type="button"
            onClick={guardar}
            disabled={pending || !rango || (menor && !tutor)}
            className="flex min-h-11 w-full items-center justify-center rounded-sm bg-accent text-sm font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-40"
          >
            {pending ? "guardando…" : "guardar"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
