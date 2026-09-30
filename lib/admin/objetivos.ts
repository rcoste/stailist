import { origenDesdeDato } from "@/lib/origen";
import { mediana } from "@/lib/admin/embudo-tiempos";
import type { FilaPerfilAdquisicion } from "@/lib/admin/adquisicion";
import {
  PARO_MINIMO_VOLVIERON,
  PARO_MUESTRA,
  costoPor,
  esDeCampana,
  type EstadoParo,
  type ResumenCampana,
} from "@/lib/admin/campana";

// LOS OBJETIVOS DEL PLAN P-03, CONTRA LO QUE VA PASANDO.
//
// POR QUÉ EXISTE
// El plan P-03 (docs_para_claude/Plan_Stailist_P-03_excepcion.md, 2026-09-29)
// escribió ANTES de gastar qué cuenta como buena señal y qué como alarma. Si
// esos números viven sólo en un documento, a la segunda semana nadie los mira y
// el dato se lee con el ánimo del día. Aquí cada objetivo queda al lado de su
// número real, con un estado en palabras (el color nunca dice nada solo).
//
// Los umbrales son ESTIMADOS de confianza baja (salvo el criterio de paro, que
// es un acuerdo): se cambian aquí, en un solo lugar, y el plan dice por qué.
// Funciones puras: la carga vive en campana-datos.ts.

export const OBJETIVOS = {
  /** Tope de pauta de los tres canales juntos (1,500 MXN por semana por canal). */
  topeMxn: 13_500,
  /** Días con anuncios: del 1 al 18 de octubre (18 días). */
  anunciosDesde: "2026-10-01",
  anunciosHasta: "2026-10-18",
  /** Clics ÷ impresiones. Búsqueda y redes se leen con varas distintas. */
  ctr: {
    busqueda: { senal: 0.03, alarma: 0.015 },
    redes: { senal: 0.01, alarma: 0.005 },
  },
  /** Pauta ÷ registros (sin IA: es lo que cuesta traer a alguien). */
  costoRegistro: { senal: 200, alarma: 400 },
  /** Registro → primer look. */
  registroAPrimerLook: { senal: 0.4, alarma: 0.3 },
  /** Regla ya acordada: un canal así se apaga. */
  apagarCanal: { costoPrimerLook: 800, gastoMinimo: 2_000 },
  /** Menos que esto y un porcentaje no dice nada todavía. */
  muestraMinima: 10,
} as const;

export type Estado = "bien" | "vigilar" | "alarma" | "sin-datos";

export type LineaObjetivo = {
  clave: string;
  objetivo: string;
  meta: string;
  real: string;
  estado: Estado;
  nota?: string;
};

export type Canal = "google" | "meta" | "tiktok" | "otro";

export const NOMBRE_CANAL: Record<Canal, string> = {
  google: "Google",
  meta: "Instagram y Facebook",
  tiktok: "TikTok",
  otro: "Otro",
};

/** De la fuente (utm_source o id de clic) al canal donde se paga. */
export function canalDe(fuente: string): Canal {
  const f = fuente.toLowerCase();
  if (f.startsWith("google")) return "google";
  if (f.startsWith("tiktok")) return "tiktok";
  if (f.startsWith("instagram") || f.startsWith("facebook") || f.startsWith("meta") || f === "ig" || f === "fb")
    return "meta";
  return "otro";
}

/** Una fila del resumen es de anuncios si trae campaña o gasto capturado. */
export const esFilaDeCampana = (r: ResumenCampana) => r.campana !== "—" || r.costoMxn != null;

export type TotalCanal = {
  canal: Canal;
  impresiones: number | null;
  clics: number | null;
  costoMxn: number | null;
  registro: number;
  primerLook: number;
  iaUsd: number;
};

export function totalesPorCanal(resumen: ResumenCampana[]): TotalCanal[] {
  const m = new Map<Canal, TotalCanal>();
  const suma = (a: number | null, b: number | null) => (b == null ? a : (a ?? 0) + b);
  for (const r of resumen.filter(esFilaDeCampana)) {
    const canal = canalDe(r.fuente);
    const t = m.get(canal) ?? { canal, impresiones: null, clics: null, costoMxn: null, registro: 0, primerLook: 0, iaUsd: 0 };
    t.impresiones = suma(t.impresiones, r.impresiones);
    t.clics = suma(t.clics, r.clics);
    t.costoMxn = suma(t.costoMxn, r.costoMxn);
    t.registro += r.registro;
    t.primerLook += r.primerLook;
    t.iaUsd += r.iaUsd;
    m.set(canal, t);
  }
  const orden: Canal[] = ["google", "meta", "tiktok", "otro"];
  return orden.filter((c) => m.has(c)).map((c) => m.get(c)!);
}

const pct = (x: number) => `${(Math.round(x * 1000) / 10).toString()}%`;
const mxn = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

/** Días de anuncios ya corridos, contando hoy; 0 antes de arrancar, 18 como máximo. */
export function diasCorridos(hoy: string): number {
  const { anunciosDesde, anunciosHasta } = OBJETIVOS;
  if (hoy < anunciosDesde) return 0;
  const d = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
  return Math.min(d(anunciosDesde, hoy) + 1, d(anunciosDesde, anunciosHasta) + 1);
}

/**
 * CADA OBJETIVO CONTRA SU NÚMERO. `hoy` en YYYY-MM-DD, hora de CDMX.
 * El orden es el del plan: primero lo que decide, luego el diagnóstico, al
 * final el dinero.
 */
export function evaluarObjetivos(input: {
  resumen: ResumenCampana[];
  paro: EstadoParo;
  hoy: string;
}): LineaObjetivo[] {
  const O = OBJETIVOS;
  const out: LineaObjetivo[] = [];
  const canales = totalesPorCanal(input.resumen);
  const tot = canales.reduce(
    (a, c) => ({
      costo: c.costoMxn == null ? a.costo : (a.costo ?? 0) + c.costoMxn,
      registro: a.registro + c.registro,
      primerLook: a.primerLook + c.primerLook,
    }),
    { costo: null as number | null, registro: 0, primerLook: 0 }
  );

  // 1. Lo que decide: el criterio de paro, sin redefinirlo.
  const p = input.paro;
  out.push({
    clave: "recurrencia",
    objetivo: "Vuelven en su primera semana",
    meta: `${PARO_MINIMO_VOLVIERON} de las primeras ${PARO_MUESTRA} con primer look`,
    real: `${p.volvieron} de ${p.conPrimerLook} (${p.cerradas} ya cumplieron su semana)`,
    estado: p.estado === "pasa" ? "bien" : p.estado === "no-pasa" ? "alarma" : "sin-datos",
    nota: "La métrica única. Menos de 6: se mata.",
  });

  // 2. Registro → primer look.
  const { senal: rs, alarma: ra } = O.registroAPrimerLook;
  const tasa = tot.registro ? tot.primerLook / tot.registro : null;
  out.push({
    clave: "registro-a-look",
    objetivo: "Del registro al primer look",
    meta: `${pct(rs)} o más · alarma debajo de ${pct(ra)}`,
    real: tasa == null ? "—" : `${pct(tasa)} (${tot.primerLook} de ${tot.registro})`,
    estado:
      tasa == null || tot.registro < O.muestraMinima
        ? "sin-datos"
        : tasa >= rs
          ? "bien"
          : tasa < ra
            ? "alarma"
            : "vigilar",
    nota: "Si falla, el onboarding en frío está roto en algún paso: ver el embudo.",
  });

  // 3. Costo por registro (sólo pauta).
  const { senal: cs, alarma: ca } = O.costoRegistro;
  const cpr = tot.costo != null && tot.registro ? tot.costo / tot.registro : null;
  out.push({
    clave: "costo-registro",
    objetivo: "Costo por registro",
    meta: `${mxn(cs)} o menos · alarma arriba de ${mxn(ca)}`,
    real: cpr != null ? `${mxn(cpr)} (${tot.registro} registros)` : tot.costo != null ? `${mxn(tot.costo)} sin registros` : "—",
    estado:
      tot.costo == null
        ? "sin-datos"
        : cpr == null
          ? tot.costo > ca
            ? "alarma"
            : "sin-datos"
          : cpr <= cs
            ? "bien"
            : cpr > ca
              ? "alarma"
              : "vigilar",
    nota: "Pauta ÷ registros, sin IA. Se usa para comparar canales, no decide sola.",
  });

  // 4. Por canal: CTR y la regla de apagar.
  for (const c of canales.filter((x) => x.canal !== "otro")) {
    const nombre = NOMBRE_CANAL[c.canal];
    const vara = c.canal === "google" ? O.ctr.busqueda : O.ctr.redes;
    const ctr = c.impresiones && c.clics != null ? c.clics / c.impresiones : null;
    out.push({
      clave: `ctr-${c.canal}`,
      objetivo: `CTR en ${nombre}`,
      meta: `${pct(vara.senal)} o más · alarma debajo de ${pct(vara.alarma)}`,
      real: ctr == null ? "—" : `${pct(ctr)} (${c.clics} de ${c.impresiones})`,
      estado: ctr == null ? "sin-datos" : ctr >= vara.senal ? "bien" : ctr < vara.alarma ? "alarma" : "vigilar",
      nota: ctr == null ? "Falta capturar las impresiones del día." : undefined,
    });

    const { costoPrimerLook: tope, gastoMinimo } = O.apagarCanal;
    const cpl = costoPor(
      { costoMxn: c.costoMxn, iaUsd: c.iaUsd } as ResumenCampana,
      c.primerLook
    );
    const gastado = c.costoMxn ?? 0;
    out.push({
      clave: `apagar-${c.canal}`,
      objetivo: `Costo por primer look en ${nombre}`,
      meta: `Hasta ${mxn(tope)} · arriba, con ${mxn(gastoMinimo)} gastados, se apaga el canal`,
      real:
        cpl != null
          ? `${mxn(cpl)} (${c.primerLook} primeros looks, ${mxn(gastado)} gastados)`
          : c.costoMxn != null
            ? `${mxn(gastado)} gastados, ningún primer look`
            : "—",
      estado:
        c.costoMxn == null
          ? "sin-datos"
          : gastado < gastoMinimo
            ? cpl != null && cpl <= tope
              ? "bien"
              : "sin-datos"
            : cpl == null || cpl > tope
              ? "alarma"
              : "bien",
      nota: gastado >= gastoMinimo && (cpl == null || cpl > tope) ? "Se cumplió la regla: apagar este canal." : undefined,
    });
  }

  // 5. El dinero contra el tope, con el ritmo al día.
  const dias = diasCorridos(input.hoy);
  const gastado = tot.costo ?? 0;
  const proyeccion = dias ? (gastado / dias) * diasCorridos(O.anunciosHasta) : null;
  out.push({
    clave: "tope",
    objetivo: "Gasto contra el tope",
    meta: `${mxn(O.topeMxn)} en total, anuncios del 1 al 18 de octubre`,
    real:
      tot.costo == null
        ? "—"
        : `${mxn(gastado)} (${pct(gastado / O.topeMxn)} del tope)` +
          (proyeccion != null ? ` · a este ritmo: ${mxn(proyeccion)}` : ""),
    estado:
      tot.costo == null
        ? "sin-datos"
        : gastado > O.topeMxn
          ? "alarma"
          : proyeccion != null && proyeccion > O.topeMxn
            ? "vigilar"
            : "bien",
  });

  return out;
}

export const TEXTO_ESTADO: Record<Estado, string> = {
  bien: "va bien",
  vigilar: "vigilar",
  alarma: "alarma",
  "sin-datos": "faltan datos",
};

// ─── El uso en su primera semana ────────────────────────────────────────────

export const MODULOS = [
  { clave: "viaje", etiqueta: "viaje" },
  { clave: "capsula", etiqueta: "cápsula" },
  { clave: "prueba", etiqueta: "prueba puesta" },
  { clave: "fitcheck", etiqueta: "fit check" },
  { clave: "adelantado", etiqueta: "look por adelantado" },
] as const;
export type Modulo = (typeof MODULOS)[number]["clave"];

/** Lo que hizo una persona en sus primeros DIAS_VENTANA días. */
export type UsoCuenta = {
  ropaPropia: number;
  looks: number;
  modulos: Record<Modulo, boolean>;
};

export type ResumenUso = {
  /** Personas de anuncios que llegaron a su primer look. */
  personas: number;
  conRopaPropia: number;
  ropaPropiaMediana: number | null;
  looksMediana: number | null;
  modulos: Record<Modulo, number>;
};

/**
 * Sin objetivo escrito a propósito: el plan dice que la primera semana fija la
 * referencia. Lo que sí importa es leerlo junto a "volvió": si no vuelven,
 * ¿subieron su ropa, vieron más de un look, descubrieron algo más?
 */
export function resumirUso(filas: FilaPerfilAdquisicion[], uso: Map<string, UsoCuenta>): ResumenUso {
  const gente = filas.filter((f) => f.onboarding_step >= 5 && esDeCampana(origenDesdeDato(f.origen)));
  const datos = gente.map((f) => uso.get(f.id)).filter((u): u is UsoCuenta => !!u);
  const modulos = Object.fromEntries(MODULOS.map((m) => [m.clave, datos.filter((u) => u.modulos[m.clave]).length])) as Record<
    Modulo,
    number
  >;
  return {
    personas: gente.length,
    conRopaPropia: datos.filter((u) => u.ropaPropia > 0).length,
    ropaPropiaMediana: mediana(datos.map((u) => u.ropaPropia)),
    looksMediana: mediana(datos.map((u) => u.looks)),
    modulos,
  };
}

// ─── El correo diario ───────────────────────────────────────────────────────

/** Los objetivos en texto plano, para el correo de las 8 am. */
export function textoObjetivos(lineas: LineaObjetivo[], uso: ResumenUso): string[] {
  const out = ["OBJETIVOS DEL PLAN P-03"];
  for (const l of lineas) {
    out.push(`- [${TEXTO_ESTADO[l.estado]}] ${l.objetivo}: ${l.real} · meta: ${l.meta}${l.nota && l.estado === "alarma" ? ` · ${l.nota}` : ""}`);
  }
  if (uso.personas > 0) {
    const mods = MODULOS.map((m) => `${m.etiqueta} ${uso.modulos[m.clave]}`).join(", ");
    out.push(
      `- Uso en su primera semana (${uso.personas} de anuncios con primer look): ` +
        `${uso.conRopaPropia} subieron ropa propia (mediana ${uso.ropaPropiaMediana ?? "—"} prendas), ` +
        `mediana de ${uso.looksMediana ?? "—"} looks; módulos: ${mods}`
    );
  }
  return out;
}
