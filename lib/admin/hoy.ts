// HOY: la primera pantalla del admin, replanteada el 2026-10-09.
//
// Roberto pidió repensar el admin desde cero: "lo veo complejo, todo all over
// the place". El diagnóstico fue que 17 pantallas habían nacido una por una,
// cada una de una pregunta de un día distinto, y el Dashboard seguía siendo el
// de junio (ratio de 👍, viajes, esenciales: el experimento con Tatiana). Esta
// pantalla contesta la única pregunta que se hace cada mañana: "¿cómo va?".
//
// Tres bloques, en este orden: el experimento (los números del plan P-03),
// qué pasó desde ayer (quién llegó, quién volvió) y lo que hay que atender.
// Es el correo de las 8 de la mañana como página; las definiciones son las
// mismas que ahí (lib/admin/campana.ts) para que nunca se contradigan.

import {
  MXN_POR_USD,
  PARO_MINIMO_VOLVIERON,
  PARO_MUESTRA,
  esDeCampana,
  origenEnPalabras,
  pasoEnPalabras,
  type EstadoParo,
  type ExtraCuenta,
  type ResumenCampana,
} from "@/lib/admin/campana";
import { esFilaDeCampana, OBJETIVOS } from "@/lib/admin/objetivos";
import type { FilaPerfilAdquisicion } from "@/lib/admin/adquisicion";
import { origenDesdeDato } from "@/lib/origen";
import { lugarEnPalabras } from "@/lib/lugar";

/** Costo por primer look de TODAS las campañas juntas: anuncio + IA, en MXN. */
export function costoPorPrimerLookTotal(resumen: ResumenCampana[]): number | null {
  const filas = resumen.filter(esFilaDeCampana).filter((r) => r.costoMxn != null);
  const gasto = filas.reduce((t, r) => t + (r.costoMxn ?? 0) + r.iaUsd * MXN_POR_USD, 0);
  const looks = filas.reduce((t, r) => t + r.primerLook, 0);
  return looks === 0 || gasto === 0 ? null : gasto / looks;
}

/** Días que faltan para la lectura del plan (OBJETIVOS.anunciosHasta); 0 si ya pasó. */
export function diasParaLaLectura(hoy: string): number {
  const d = Math.round((Date.parse(`${OBJETIVOS.anunciosHasta}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000);
  return Math.max(0, d);
}

/** El criterio de paro, en una frase y un tono. */
export function estadoDelExperimento(p: EstadoParo): { frase: string; tono: "bien" | "mal" | "neutro" } {
  if (p.estado === "pasa") return { frase: `pasa: ya volvieron ${p.volvieron}, y la regla pedía ${PARO_MINIMO_VOLVIERON}`, tono: "bien" };
  if (p.estado === "no-pasa") return { frase: `no pasa: volvieron ${p.volvieron} y ya no se puede llegar a ${PARO_MINIMO_VOLVIERON}`, tono: "mal" };
  // `volvieron` cuenta también a quien sigue dentro de su semana; `cerradas`
  // es cuántas ya no pueden cambiar. Las dos cosas se dicen por separado.
  return {
    frase: `${p.conPrimerLook} de ${PARO_MUESTRA} primeros looks · ya volvieron ${p.volvieron} · ${p.cerradas} cerraron su semana sin cambio posible · la regla pide ${PARO_MINIMO_VOLVIERON} de ${PARO_MUESTRA}`,
    tono: "neutro",
  };
}

/** Una persona que empezó en un día dado: quién es y hasta dónde llegó. */
export type Llegada = {
  id: string;
  correo: string;
  pais: string | null;
  lugar: string | null;
  origen: string;
  deAnuncio: boolean;
  paso: string;
  primerLook: boolean;
  fotos: number;
};

/** Los números de un día: cuántas llegaron, cuántas al primer look, cuántas subieron ropa. */
export type ResumenDia = {
  dia: string;
  llegaron: Llegada[];
  nuevas: number;
  nuevasDeAnuncio: number;
  primerLook: number;
  subieronFotos: number;
};

export function resumenDelDia(filas: FilaPerfilAdquisicion[], extras: Map<string, ExtraCuenta>, dia: string): ResumenDia {
  const llegaron = filas
    .filter((f) => f.dia_inicio === dia)
    .map((f): Llegada => {
      const o = origenDesdeDato(f.origen);
      const x = extras.get(f.id);
      return {
        id: f.id,
        correo: f.email ?? "(sin correo todavía)",
        pais: x?.pais ?? null,
        lugar: lugarEnPalabras(x?.pais, x?.region),
        origen: origenEnPalabras(o, f.como_nos_conocio),
        deAnuncio: esDeCampana(o),
        paso: pasoEnPalabras(f.onboarding_step, f.gender, !f.email),
        primerLook: f.onboarding_step >= 5,
        fotos: x?.fotos ?? 0,
      };
    })
    // Primero quien llegó más lejos: lo que importa arriba.
    .sort((a, b) => Number(b.primerLook) - Number(a.primerLook) || b.fotos - a.fotos);
  return {
    dia,
    llegaron,
    nuevas: llegaron.length,
    nuevasDeAnuncio: llegaron.filter((l) => l.deAnuncio).length,
    primerLook: llegaron.filter((l) => l.primerLook).length,
    subieronFotos: llegaron.filter((l) => l.fotos > 0).length,
  };
}

/** "hoy", "ayer", o el día en palabras. */
export function nombreDelDia(dia: string, hoy: string): string {
  if (dia === hoy) return "hoy";
  const ayer = new Date(Date.parse(`${hoy}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  if (dia === ayer) return "ayer";
  return new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
