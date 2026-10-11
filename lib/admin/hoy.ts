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
  quienesVolvieron,
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

// ── LO QUE SE AGREGÓ AL VERLO EN PANTALLA (2026-10-11) ─────────────────────
// Hasta aquí Hoy se había verificado con números pero nunca mirado. Al verlo:
// cuatro cuadros del mismo peso y ninguno decía si el experimento va bien; el
// criterio de paro era una línea densa ("2 cerraron su semana sin cambio
// posible"); pesos y dólares sin rotular lado a lado; y ninguna tendencia.

/** El veredicto del plan como lo diría una persona, con sus dos barras de avance. */
export type Veredicto = {
  titulo: string;
  detalle: string;
  muestra: { n: number; de: number };
  regresos: { n: number; de: number };
  tono: "bien" | "mal" | "neutro";
};

export function veredicto(p: EstadoParo): Veredicto {
  const muestra = { n: Math.min(p.conPrimerLook, PARO_MUESTRA), de: PARO_MUESTRA };
  const regresos = { n: p.volvieron, de: PARO_MINIMO_VOLVIERON };
  if (p.estado === "pasa") {
    return { titulo: "El experimento pasa", detalle: `Ya volvieron ${p.volvieron}; la regla pedía ${PARO_MINIMO_VOLVIERON}. Se puede escalar.`, muestra, regresos, tono: "bien" };
  }
  if (p.estado === "no-pasa") {
    return {
      titulo: "El experimento no pasa",
      detalle: `Volvieron ${p.volvieron} y ya no se puede llegar a ${PARO_MINIMO_VOLVIERON}: demasiadas semanas cerraron sin regreso. La regla dice parar y no escalar.`,
      muestra,
      regresos,
      tono: "mal",
    };
  }
  const faltanLooks = Math.max(0, PARO_MUESTRA - p.conPrimerLook);
  const faltanRegresos = Math.max(0, PARO_MINIMO_VOLVIERON - p.volvieron);
  const abiertas = Math.max(0, p.conPrimerLook - p.cerradas);
  const partes = [
    faltanLooks ? `faltan ${faltanLooks} primer${faltanLooks === 1 ? "" : "os"} look${faltanLooks === 1 ? "" : "s"} para completar la muestra` : "la muestra ya está completa",
    faltanRegresos ? `y ${faltanRegresos} regreso${faltanRegresos === 1 ? "" : "s"} para pasar` : "y ya hay regresos suficientes",
  ];
  return {
    titulo: "Todavía no se sabe",
    detalle: `${(() => {
      const t = partes.join(" ");
      return t.charAt(0).toUpperCase() + t.slice(1);
    })()}. ${abiertas} persona${abiertas === 1 ? " sigue" : "s siguen"} dentro de su primera semana: aún pueden volver.`,
    muestra,
    regresos,
    tono: "neutro",
  };
}

/** Un día de la tendencia: cuántas llegaron a su primer look y cuántas volvieron. */
export type DiaTendencia = { dia: string; primerLook: number; volvieron: number };

/**
 * Los últimos `dias` días, del más viejo al más nuevo. Primer look por el día
 * en que empezó (la gente llega a su primer look el mismo día casi siempre);
 * volvieron con quienesVolvieron, la misma cuenta que el correo de las 8.
 */
export function tendencia(filas: FilaPerfilAdquisicion[], hoy: string, dias = 14): DiaTendencia[] {
  return Array.from({ length: dias }, (_, i) => {
    const dia = new Date(Date.parse(`${hoy}T00:00:00Z`) - (dias - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return {
      dia,
      primerLook: filas.filter((f) => f.dia_inicio === dia && f.onboarding_step >= 5).length,
      volvieron: quienesVolvieron(filas, dia).length,
    };
  });
}

/** ¿La campaña gastó en los últimos `dias` días? Una pausada no se lee igual que una viva. */
export function campanaActiva(gasto: { dia: string; campana: string; costo_mxn: number }[], campana: string, hoy: string, dias = 3): boolean {
  const desde = new Date(Date.parse(`${hoy}T00:00:00Z`) - dias * 86_400_000).toISOString().slice(0, 10);
  return gasto.some((g) => g.campana === campana && g.dia >= desde && Number(g.costo_mxn) > 0);
}
