"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  VARIANTES_MOTOR,
  estimadoMotor,
  N_VISTAZO,
  MIN_VEREDICTO,
  MAX_VEREDICTO,
  nRepetidos,
  type TamanoCorrida,
} from "@/lib/comparador/motor";
import { formatoUsd } from "@/lib/proveedores/precios";
import { abrirCorridaMotor } from "../../motor-actions";

// Elegir las dos variantes, el tamaño, ESCRIBIR LA REGLA (antes de votar, no
// después) y ver el costo antes del botón.

const TAMANOS: { tamano: TamanoCorrida; label: string; ayuda: string }[] = [
  {
    tamano: "vistazo",
    label: `Vistazo (${N_VISTAZO} pares)`,
    ayuda: "encontrar defectos y sacar reglas · NUNCA declara ganador",
  },
  {
    tamano: "veredicto",
    label: `Veredicto (${MIN_VEREDICTO}-${MAX_VEREDICTO} pares)`,
    ayuda: "decidir, con la regla pre-registrada · incluye pares espejo",
  },
];

export function NuevaCorridaMotor() {
  const router = useRouter();
  const [tamano, setTamano] = useState<TamanoCorrida>("vistazo");
  const [n, setN] = useState(MIN_VEREDICTO);
  // Dos variantes, en orden de elección. Producción arranca puesta: casi toda
  // pregunta útil es "algo contra el control".
  const [elegidos, setElegidos] = useState<string[]>(["produccion"]);
  const [regla, setRegla] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const nPares = tamano === "vistazo" ? N_VISTAZO : n;
  const costo = useMemo(
    () => (elegidos.length === 2 ? estimadoMotor(elegidos, nPares) : null),
    [elegidos, nPares]
  );

  const lanzar = () =>
    empezar(async () => {
      setError(null);
      if (elegidos.length !== 2) return;
      const r = await abrirCorridaMotor({
        tamano,
        nPares,
        varianteA: elegidos[0],
        varianteB: elegidos[1],
        regla,
      });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.push(`/admin/comparador/motor/${r.id}`);
    });

  const elegirVariante = (clave: string) =>
    setElegidos((xs) =>
      xs.includes(clave) ? xs.filter((x) => x !== clave) : [...xs, clave].slice(-2)
    );

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tamaño</p>
        <div className="flex flex-col gap-2">
          {TAMANOS.map((t) => (
            <button
              key={t.tamano}
              onClick={() => setTamano(t.tamano)}
              className={`rounded-xl border p-3 text-left ${
                tamano === t.tamano ? "border-accent bg-accent-soft" : "border-line"
              }`}
            >
              <span className="block text-sm font-semibold text-ink">{t.label}</span>
              <span className="block text-xs text-muted">{t.ayuda}</span>
            </button>
          ))}
        </div>
        {tamano === "veredicto" ? (
          <label className="flex items-center justify-between gap-3 rounded-xl bg-bg p-3">
            <span className="text-sm text-muted">
              Pares: <span className="font-semibold text-ink">{n}</span> + {nRepetidos("veredicto", n)} espejo
            </span>
            <input
              type="range"
              min={MIN_VEREDICTO}
              max={MAX_VEREDICTO}
              step={2}
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              className="w-40 accent-current"
            />
          </label>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Quiénes compiten (elige dos)
        </p>
        <div className="flex flex-col gap-2">
          {VARIANTES_MOTOR.map((v) => {
            const elegida = elegidos.includes(v.clave);
            return (
              <button
                key={v.clave}
                onClick={() => elegirVariante(v.clave)}
                className={`rounded-xl border p-3 text-left ${
                  elegida ? "border-accent bg-accent-soft" : "border-line"
                }`}
              >
                <span className="block text-sm font-semibold text-ink">{v.etiqueta}</span>
                <span className="block text-xs text-muted">{v.ayuda}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted">
          El juez es el mismo para las dos (la variable bajo prueba es el
          generador). Los looks se arman sobre TU clóset y no ensucian tu
          historial.
        </p>
      </div>

      {tamano === "veredicto" ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            La regla, ANTES de votar
          </p>
          <textarea
            value={regla}
            onChange={(e) => setRegla(e.target.value)}
            rows={3}
            placeholder={`Ej: si la variante nueva no gana con p<0.05, se queda producción tal cual.`}
            className="rounded-xl border border-line bg-bg p-3 text-sm text-ink placeholder:text-muted"
          />
          <p className="text-xs text-muted">
            Qué cuenta como ganar y qué haces si no gana. Se escribe ahora
            porque explicar la derrota después de verla no cuenta.
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 rounded-xl bg-bg p-3">
        <span className="text-sm text-muted">Cuesta más o menos</span>
        <span className="text-base font-semibold text-ink">
          {costo === null ? "—" : formatoUsd(costo)}
        </span>
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}

      <button
        disabled={pendiente || elegidos.length !== 2}
        onClick={lanzar}
        className="rounded-xl bg-ink py-4 text-base font-semibold text-bg active:opacity-80 disabled:opacity-50"
      >
        {pendiente ? "Abriendo…" : "Abrir la corrida"}
      </button>
      <p className="text-xs text-muted">
        Abrir no gasta nada: la generación se lanza en la siguiente pantalla,
        por bloques y con el costo a la vista.
      </p>
    </div>
  );
}
