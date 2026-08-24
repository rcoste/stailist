"use client";

import { useState, useTransition } from "react";
import { TIPOS_EVENTO } from "@/lib/eventos";
import { REGISTRO_OPCIONES, type RegistroPorPlan, type RegistroPlan } from "@/lib/registro-plan";
import { guardarRegistroPlan } from "@/app/perfil/actions";

// EL DIAL DE REGISTRO POR PLAN, en el perfil. La capa 2 de las tres capas:
// cuánto te arreglas para una cita no es regla del motor ni gusto del juez —
// es tuyo. Default = consenso del catálogo; cada plan se mueve UN paso.
// Se guarda al tocar (sin botón): la lección del cruce.
//
// Sólo los planes SOCIALES del wizard (los mismos 6 de un toque): trabajo ya
// tiene su propia pregunta (dress code) y el diario no tiene norma que mover.
const PLANES = ["cena-amigos", "cita", "comida-familiar", "comida-trabajo", "fiesta", "boda"];

export function RegistroPlanCard({ inicial }: { inicial: RegistroPorPlan | null }) {
  const [registro, setRegistro] = useState<RegistroPorPlan>(inicial ?? {});
  const [, empezar] = useTransition();
  const [error, setError] = useState(false);

  const tocar = (plan: string, valor: RegistroPlan | null) => {
    setRegistro((prev) => {
      const next = { ...prev };
      if (valor) next[plan] = valor;
      else delete next[plan];
      return next;
    });
    empezar(async () => {
      const r = await guardarRegistroPlan(plan, valor);
      setError(!r.ok);
    });
  };

  return (
    <div className="flex flex-col gap-3 border-t border-line p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Cómo vas a cada plan
        </span>
        <span className="text-xs text-muted">
          Tus looks y su calificación se ajustan a esto — "muy formal" depende de cómo vayas tú.
        </span>
      </div>
      {error ? <p className="text-xs text-error">no se guardó — intenta de nuevo</p> : null}
      <div className="flex flex-col gap-2.5">
        {PLANES.map((key) => {
          const t = TIPOS_EVENTO.find((x) => x.key === key);
          if (!t) return null;
          const actual = registro[key] ?? null;
          return (
            <div key={key} className="flex flex-col gap-1">
              <span className="text-sm font-medium capitalize text-ink">{t.label}</span>
              <div className="grid grid-cols-3 gap-1">
                {REGISTRO_OPCIONES.map((op) => (
                  <button
                    key={op.label}
                    type="button"
                    onClick={() => tocar(key, actual === op.valor ? null : op.valor)}
                    className={`rounded-lg border py-1.5 text-xs font-medium ${
                      actual === op.valor
                        ? "border-ink bg-ink text-bg"
                        : "border-line text-muted active:bg-tile"
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
