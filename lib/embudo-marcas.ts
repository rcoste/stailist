import { withDb } from "@/lib/db";
import { parseOrigen } from "@/lib/origen";
import { campanaDe, diaEnZona, fuenteDe } from "@/lib/admin/adquisicion";

// LAS MARCAS DEL EMBUDO (migración 0168): landing → botón → pantalla del
// correo → código verificado, por campaña y día.
//
// Por qué existen está en la migración. Lo esencial: son los pasos que pasan
// antes de que haya una cuenta (o con un borrador que se va a borrar), y por
// eso no se pueden reconstruir después desde profiles ni events.
//
// Mismo contrato que lib/campana-codigos.ts: sólo contadores, el origen sale de
// la cookie de primera parte (la misma que decide el origen de la cuenta), y es
// best-effort — perder una marca nunca le cuesta nada a quien está entrando.

export const PASOS_EMBUDO = ["landing", "boton", "correo_visto", "correo_ok"] as const;
export type PasoEmbudo = (typeof PASOS_EMBUDO)[number];

export function esPasoEmbudo(x: unknown): x is PasoEmbudo {
  return typeof x === "string" && (PASOS_EMBUDO as readonly string[]).includes(x);
}

/** El id que manda el navegador: aleatorio, corto y sin nada que lo identifique. */
export function sujetoValido(x: unknown): x is string {
  return typeof x === "string" && /^[A-Za-z0-9-]{8,64}$/.test(x);
}

/**
 * Las pruebas no cuentan. Mis recorridos automáticos usan utm_campaign
 * "prueba-borrador" (ver marketing-stailist/demos-producto/captura/), y una
 * campaña que empiece con "prueba" no es tráfico.
 */
export function esCampanaDePrueba(campana: string): boolean {
  return campana.toLowerCase().startsWith("prueba");
}

export async function marcarPaso(
  paso: PasoEmbudo,
  sujeto: string,
  cookieOrigen: string | undefined,
  ahora: Date = new Date()
): Promise<void> {
  if (!sujetoValido(sujeto)) return;
  const o = parseOrigen(cookieOrigen);
  const campana = campanaDe(o);
  if (esCampanaDePrueba(campana)) return;
  try {
    await withDb((c) =>
      c.query(
        `insert into public.embudo_marcas (sujeto, paso, dia, fuente, campana)
         values ($1, $2, $3::date, $4, $5)
         on conflict (sujeto, paso) do nothing`,
        [sujeto, paso, diaEnZona(ahora), fuenteDe(o), campana]
      )
    );
  } catch (e) {
    console.error(`[embudo] no se marcó ${paso}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
