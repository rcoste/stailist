"use client";

import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { pushActivo } from "@/lib/avisos-push";
import { apagarAvisos } from "@/lib/push-actions";
import {
  desuscribirEsteNavegador,
  esIPhone,
  estaInstalada,
  soportaPush,
  suscripcionActual,
  suscribirEsteNavegador,
} from "@/lib/push-navegador";

// EL INTERRUPTOR DE LOS AVISOS EN PERFIL → CUENTA, al lado del correo semanal.
//
// Refleja ESTE teléfono, no la cuenta: la suscripción vive en el navegador, y
// una persona con dos teléfonos (o un teléfono compartido) necesita ver la
// verdad del que tiene en la mano. La preferencia de la cuenta (`inicial`)
// sólo matiza el texto cuando este teléfono no está suscrito pero otro sí.
// Apagarlo aquí apaga la CUENTA entera (todos sus teléfonos) — es lo que la
// gente espera de un interruptor que dice "apagado".
//
// No se pinta sin NEXT_PUBLIC_AVISOS_PUSH=1.

type Dispositivo = "cargando" | "si" | "no" | "sin_soporte" | "no_instalada" | "bloqueado";

/** La verdad de ESTE teléfono, en orden: ¿puede? ¿está instalada (iPhone)? ¿bloqueó? ¿ya está suscrito? */
async function detectarDispositivo(): Promise<Dispositivo> {
  if (!soportaPush()) return "sin_soporte";
  if (esIPhone() && !estaInstalada()) return "no_instalada";
  if (Notification.permission === "denied") return "bloqueado";
  return (await suscripcionActual()) ? "si" : "no";
}

export function AvisosPushToggle({ inicial }: { inicial: "on" | "off" | null }) {
  const activo = pushActivo();
  const [cuenta, setCuenta] = useState(inicial);
  const [dispositivo, setDispositivo] = useState<Dispositivo>("cargando");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    void detectarDispositivo().then((d) => {
      if (vivo) setDispositivo(d);
    });
    return () => {
      vivo = false;
    };
  }, [activo]);

  if (!activo) return null;

  const encendido = dispositivo === "si";
  const puedeTocar = dispositivo === "si" || dispositivo === "no";

  function cambiar() {
    setError(false);
    start(async () => {
      if (encendido) {
        const endpoint = await desuscribirEsteNavegador();
        const r = await apagarAvisos(endpoint, "perfil");
        if (!r.ok) return setError(true);
        setDispositivo("no");
        setCuenta("off");
      } else {
        const r = await suscribirEsteNavegador("perfil");
        if (r.ok) {
          setDispositivo("si");
          setCuenta("on");
        } else if (r.motivo === "permiso_negado") {
          setDispositivo("bloqueado");
        } else if (r.motivo === "no_instalada") {
          setDispositivo("no_instalada");
        } else {
          setError(true);
        }
      }
    });
  }

  const detalle = error
    ? "no se guardó — inténtalo de nuevo."
    : dispositivo === "cargando"
      ? "revisando este teléfono…"
      : dispositivo === "sin_soporte"
        ? "tu navegador no permite avisos."
        : dispositivo === "no_instalada"
          ? "primero agrégame a tu pantalla de inicio (Compartir → Agregar a inicio)."
          : dispositivo === "bloqueado"
            ? "tu teléfono bloqueó los avisos. actívalos en sus ajustes de notificaciones."
            : encendido
              ? "activado. lo apagas aquí cuando quieras."
              : cuenta === "on"
                ? "lo tienes en otro teléfono. actívalo aquí también si quieres."
                : "apagado. actívalo y cada mañana te aviso para armar tu look.";

  return (
    <button
      type="button"
      onClick={cambiar}
      disabled={pending || !puedeTocar}
      aria-pressed={encendido}
      className="flex w-full items-center gap-3 rounded-md border border-line bg-surface p-4 text-left transition-colors hover:border-accent disabled:opacity-60"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon name="sol" size={16} />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-ink">un aviso cada mañana para armar tu look</span>
        <span className="text-xs text-muted">{detalle}</span>
      </div>
      <span
        aria-hidden
        className={`ml-auto flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          encendido ? "bg-accent" : "bg-line"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-surface transition-transform ${
            encendido ? "translate-x-5" : ""
          }`}
        />
      </span>
    </button>
  );
}
