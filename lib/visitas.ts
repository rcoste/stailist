import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarEvento } from "@/lib/telemetria";

// UNA VISITA AL DÍA, POR PERSONA.
//
// POR QUÉ EXISTE (Roberto, 2026-09-12). El feed sabía lo que la gente HACE,
// pero no si vino. Quien entraba, miraba y se iba no dejaba rastro: los únicos
// eventos "pasivos" que había son de rebote (los timings de una generación, un
// tip al cerrarse), así que una vuelta en blanco —la más interesante de todas—
// era invisible. La sesión de auth sí lo sabe, pero vive en `auth.sessions`,
// guarda sólo la ÚLTIMA renovación y no se puede cruzar con el feed.
//
// POR QUÉ UNA AL DÍA y no una por carga: getProfile corre en cada pantalla. Sin
// candado, una sola sesión escribiría decenas de filas y volveríamos al
// problema que el feed ya resolvió con el colapso de ráfagas. El día es la
// unidad que se lee ("volvió el martes"), y el candado es `ultima_visita`.
//
// POR QUÉ EN HORA DE CDMX: "volvió el jueves" tiene que significar el jueves de
// la persona. Con días UTC, todo lo que pasa después de las 18:00 de CDMX
// contaría como el día siguiente.

export const ZONA_VISITA = "America/Mexico_City";

/** El día natural en CDMX, "YYYY-MM-DD" (en-CA da justo ese formato). */
export function diaLocal(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_VISITA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

/**
 * El instante en que empezó el día de hoy en CDMX, en ISO.
 *
 * México dejó el horario de verano en 2022, así que CDMX es UTC-6 todo el año
 * y el desfase se puede escribir fijo. Si algún día vuelve el cambio de
 * horario, esto es lo que hay que tocar.
 */
export function inicioDelDiaLocal(ahora: Date): string {
  return `${diaLocal(ahora)}T00:00:00-06:00`;
}

/** ¿Es la primera vez que se le ve hoy? */
export function esVisitaNueva(ultima: string | null | undefined, ahora: Date): boolean {
  if (!ultima) return true;
  return diaLocal(new Date(ultima)) !== diaLocal(ahora);
}

/**
 * Escribe la visita si toca. Devuelve true sólo si de verdad la escribió.
 *
 * El update lleva la condición del día DENTRO (no basta con haberlo mirado en
 * memoria): dos pestañas abriendo a la vez entran las dos al mismo tiempo, y
 * quien no gane el update no escribe evento. Así nunca hay dos visitas del
 * mismo día.
 *
 * Nada de esto puede tumbar una pantalla: si falla, se ignora — un dato de
 * medición no vale una página rota.
 */
export async function registrarVisita(
  supabase: SupabaseClient,
  perfil: { id: string; ultima_visita?: string | null },
  ahora: Date = new Date()
): Promise<boolean> {
  if (!esVisitaNueva(perfil.ultima_visita, ahora)) return false;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({ ultima_visita: ahora.toISOString() })
      .eq("id", perfil.id)
      .or(`ultima_visita.is.null,ultima_visita.lt.${inicioDelDiaLocal(ahora)}`)
      .select("id");
    if (error || !data?.length) return false;
    await registrarEvento(supabase, {
      user_id: perfil.id,
      type: "visita",
      data: { dia: diaLocal(ahora) },
    });
    return true;
  } catch (e) {
    console.error("[visitas] no se pudo registrar:", e instanceof Error ? e.message : e);
    return false;
  }
}
