import { origenDesdeDato, type Origen } from "@/lib/origen";
import { isMinor, type AgeRange } from "@/lib/edad";
import { mediana, fmtSegundos } from "@/lib/admin/embudo-tiempos";
import type { Dispositivo } from "@/lib/dispositivo";
import {
  campanaDe,
  fuenteDe,
  ventanaCerrada,
  volvioEn7Dias,
  type FilaPerfilAdquisicion,
} from "@/lib/admin/adquisicion";

// LA CAMPAÑA EN UNA PANTALLA: del clic a "volvió", por campaña.
//
// POR QUÉ EXISTE
// El embudo estaba partido en tres lugares que no se hablan: clics y gasto en
// Google Ads, visitas en GA4, y todo lo demás en la base. /admin/adquisicion
// empieza en "abrió la app". Esta pantalla junta las ocho cifras que deciden la
// campaña y nada más, porque un panel con cuarenta cifras se deja de abrir a la
// semana (el TTV falló 4× durante meses con el número a la vista de nadie).
//
// NO REDEFINE NADA: "volvió", "ventana cerrada", fuente y campaña salen de
// lib/admin/adquisicion.ts. Si esas definiciones cambian, cambian aquí solas.
//
// Funciones puras; la carga de datos vive en campana-datos.ts.

/** El criterio de paro acordado con Roberto el 2026-09-10. */
export const PARO_MUESTRA = 30;
export const PARO_MINIMO_VOLVIERON = 6;

/**
 * Pesos por dólar para sumar la IA (en dólares) al anuncio (en pesos). Es un
 * SUPUESTO y la pantalla lo dice; se cambia con la variable MXN_POR_USD.
 */
export const MXN_POR_USD = Number(process.env.MXN_POR_USD ?? 18);

/** Lo que la base sabe de cada cuenta, además de lo de adquisición. */
export type ExtraCuenta = {
  age_range: string | null;
  ttv_s: number | null;
  se_lo_puso: boolean;
  /** Gasto de IA de esa persona en sus primeros DIAS_VENTANA días. */
  ia_usd_7d: number;
  /** Desde qué aparato arrancó el onboarding (se guarda desde el 2026-10-01). */
  dispositivo?: Dispositivo | null;
  /** Prendas en su clóset hoy, y cuántas de ellas son de foto propia. */
  prendas?: number;
  fotos?: number;
};

export type FilaCodigos = { dia: string; fuente: string; campana: string; nuevos: number; recurrentes: number };
export type FilaGasto = {
  dia: string;
  campana: string;
  clics: number;
  costo_mxn: number;
  registros_google: number | null;
  /** Veces que se mostró el anuncio (migración 0164). Opcional: sin ella no hay CTR. */
  impresiones?: number | null;
  nota?: string | null;
};

/** Los pasos del onboarding después de la edad, en el orden en que se viven. */
export const PASOS = [
  { min: 1, etiqueta: "gustos" },
  { min: 2, etiqueta: "colores" },
  { min: 3, etiqueta: "clóset" },
  { min: 4, etiqueta: "objetivo" },
  { min: 5, etiqueta: "primer look" },
] as const;

export type ResumenCampana = {
  fuente: string;
  campana: string;
  /** De la plataforma, capturado a mano. null = nadie capturó nada para esta campaña. */
  impresiones: number | null;
  clics: number | null;
  costoMxn: number | null;
  registrosGoogle: number | null;
  /** Personas nuevas que pidieron su código (sin cuenta previa). */
  pidieronCodigo: number;
  entraron: number;
  /** Dio su edad y es adulta: lo mismo que Google cuenta como "registro". */
  registro: number;
  /** Cuántas terminaron cada paso de PASOS, en el mismo orden. */
  pasos: number[];
  primerLook: number;
  ttvMedianaS: number | null;
  ventanaCerrada: number;
  volvieron: number;
  seLoPusieron: number;
  iaUsd: number;
};

/**
 * ¿Vino de un anuncio? Una etiqueta de campaña o un id de clic de anuncio.
 * `fbclid` NO basta: Facebook e Instagram se lo pegan a CUALQUIER link en que
 * alguien toque, también a una publicación orgánica, y contarlo metería
 * tráfico gratis en el criterio de paro. Un anuncio de Meta trae su utm.
 */
export function esDeCampana(o: Origen | null): boolean {
  return !!(o && (o.utm_campaign || o.gclid || o.gbraid || o.wbraid || o.ttclid));
}

const vacio = (fuente: string, campana: string): ResumenCampana => ({
  fuente,
  campana,
  impresiones: null,
  clics: null,
  costoMxn: null,
  registrosGoogle: null,
  pidieronCodigo: 0,
  entraron: 0,
  registro: 0,
  pasos: PASOS.map(() => 0),
  primerLook: 0,
  ttvMedianaS: null,
  ventanaCerrada: 0,
  volvieron: 0,
  seLoPusieron: 0,
  iaUsd: 0,
});

const SIN_RASTRO = "directo / sin rastro";

/**
 * EL CANAL DE UN GASTO QUE TODAVÍA NO TRAJO A NADIE. El gasto se captura por
 * campaña (utm_campaign), sin fuente. Si alguien ya entró por esa campaña, su
 * fila dice la fuente; si no, se lee del nombre: la convención del plan P-03 es
 * `ig-<enfoque>` para Instagram y `tt-<enfoque>` para TikTok, porque el mismo
 * enfoque corre en los dos y con el mismo nombre su gasto se mezclaría.
 */
export function fuenteDeCampana(campana: string): string {
  if (/^ig[-_]/.test(campana)) return "instagram";
  if (/^tt[-_]/.test(campana)) return "tiktok";
  return "google";
}

export function resumirCampana(input: {
  filas: FilaPerfilAdquisicion[];
  extras: Map<string, ExtraCuenta>;
  codigos: FilaCodigos[];
  gasto: FilaGasto[];
  ahora: Date;
}): ResumenCampana[] {
  const grupos = new Map<string, ResumenCampana>();
  const ttvs = new Map<string, number[]>();
  const grupo = (fuente: string, campana: string) => {
    const clave = JSON.stringify([fuente, campana]);
    let g = grupos.get(clave);
    if (!g) {
      g = vacio(fuente, campana);
      grupos.set(clave, g);
      ttvs.set(clave, []);
    }
    return { g, ttv: ttvs.get(clave)! };
  };

  for (const f of input.filas) {
    const o = origenDesdeDato(f.origen);
    const { g, ttv } = grupo(fuenteDe(o), campanaDe(o));
    const x = input.extras.get(f.id);
    g.entraron++;
    if (x?.age_range && !isMinor(x.age_range as AgeRange)) g.registro++;
    PASOS.forEach((p, i) => {
      if (f.onboarding_step >= p.min) g.pasos[i]++;
    });
    if (f.onboarding_step >= 5) g.primerLook++;
    if (x?.ttv_s != null) ttv.push(x.ttv_s);
    if (x?.se_lo_puso) g.seLoPusieron++;
    g.iaUsd += x?.ia_usd_7d ?? 0;
    if (ventanaCerrada(f.dia_inicio, input.ahora)) {
      g.ventanaCerrada++;
      if (volvioEn7Dias(f.dia_inicio, f.dias)) g.volvieron++;
    }
  }

  for (const c of input.codigos) {
    grupo(c.fuente, c.campana).g.pidieronCodigo += c.nuevos;
  }

  // Lo capturado trae sólo la campaña. Se pega a la fila que ya tenga esa
  // campaña; si todavía nadie entró por ella, nace una fila con el canal que
  // dice su nombre (fuenteDeCampana) para que el gasto se vea aunque no haya
  // traído a nadie — ése es justo el caso malo.
  for (const s of input.gasto) {
    const existente = [...grupos.values()].find((g) => g.campana === s.campana);
    const g = existente ?? grupo(fuenteDeCampana(s.campana), s.campana).g;
    if (s.impresiones != null) g.impresiones = (g.impresiones ?? 0) + s.impresiones;
    g.clics = (g.clics ?? 0) + s.clics;
    g.costoMxn = (g.costoMxn ?? 0) + Number(s.costo_mxn);
    if (s.registros_google != null) g.registrosGoogle = (g.registrosGoogle ?? 0) + s.registros_google;
  }

  for (const [clave, g] of grupos) g.ttvMedianaS = mediana(ttvs.get(clave)!);

  // Las campañas primero (por gasto, luego por cuentas); lo que no tiene rastro
  // va al final: es el fondo contra el que se lee lo demás.
  return [...grupos.values()].sort((a, b) => {
    if ((a.fuente === SIN_RASTRO) !== (b.fuente === SIN_RASTRO)) return a.fuente === SIN_RASTRO ? 1 : -1;
    return (b.costoMxn ?? 0) - (a.costoMxn ?? 0) || b.entraron - a.entraron;
  });
}

/** Pesos por persona, o null si no hay con qué dividir. */
export function costoPor(r: ResumenCampana, n: number, conIa = true): number | null {
  if (r.costoMxn == null || n === 0) return null;
  return (r.costoMxn + (conIa ? r.iaUsd * MXN_POR_USD : 0)) / n;
}

export type EstadoParo =
  | { estado: "faltan-datos"; conPrimerLook: number; cerradas: number; volvieron: number }
  | { estado: "pasa"; conPrimerLook: number; cerradas: number; volvieron: number }
  | { estado: "no-pasa"; conPrimerLook: number; cerradas: number; volvieron: number };

/**
 * EL CRITERIO DE PARO (acordado 2026-09-10): de las primeras 30 personas DE
 * CAMPAÑA que lleguen a su primer look, si menos de 6 vuelven en su semana, se
 * para y no se escala.
 *
 * Se decide en cuanto la respuesta ya no puede cambiar: 6 que volvieron pasan
 * aunque falten semanas por cerrar; y si ya son más de 24 las que cerraron su
 * semana sin volver, ni con todas las demás se llega a 6.
 */
export function criterioDeParo(filas: FilaPerfilAdquisicion[], ahora: Date): EstadoParo {
  const muestra = filas
    .filter((f) => f.onboarding_step >= 5 && esDeCampana(origenDesdeDato(f.origen)))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .slice(0, PARO_MUESTRA);
  let cerradas = 0;
  let volvieron = 0;
  for (const f of muestra) {
    if (volvioEn7Dias(f.dia_inicio, f.dias)) volvieron++;
    if (ventanaCerrada(f.dia_inicio, ahora)) cerradas++;
  }
  // Una que ya volvió cuenta aunque su semana siga abierta: volver no se deshace.
  const base = { conPrimerLook: muestra.length, cerradas, volvieron };
  if (volvieron >= PARO_MINIMO_VOLVIERON) return { estado: "pasa", ...base };
  const perdidas = muestra.filter(
    (f) => ventanaCerrada(f.dia_inicio, ahora) && !volvioEn7Dias(f.dia_inicio, f.dias)
  ).length;
  if (perdidas > PARO_MUESTRA - PARO_MINIMO_VOLVIERON) return { estado: "no-pasa", ...base };
  return { estado: "faltan-datos", ...base };
}

export function textoParo(p: EstadoParo): string {
  const cifras = `${p.volvieron} volvieron de ${p.conPrimerLook} con primer look (${p.cerradas} ya cumplieron su semana)`;
  if (p.estado === "pasa")
    return `PASA: ya volvieron ${PARO_MINIMO_VOLVIERON} o más de las primeras ${PARO_MUESTRA}. ${cifras}.`;
  if (p.estado === "no-pasa")
    return `NO PASA: ya no se puede llegar a ${PARO_MINIMO_VOLVIERON} de ${PARO_MUESTRA}. Se para y no se escala. ${cifras}.`;
  return `faltan datos: ${cifras}. Se decide con ${PARO_MINIMO_VOLVIERON} de las primeras ${PARO_MUESTRA}.`;
}

// ─── El correo diario ───────────────────────────────────────────────────────

export type DatosCorreoDiario = {
  ayer: string;
  iaAyerUsd: number;
  iaAyerLlamadas: number;
  /** Quien más gastó ayer, para ver de un vistazo si alguien se disparó. */
  iaTop: { correo: string; usd: number } | null;
  nuevasAyer: number;
  nuevasAyerDeCampana: number;
  primerLookAyer: number;
  campanas: ResumenCampana[];
  paro: EstadoParo;
  desde: string;
  /** Los objetivos del plan P-03 ya escritos en texto (lib/admin/objetivos.ts). */
  objetivos?: string[];
  /** Una fila por cuenta que arrancó ayer: quién, de dónde y hasta dónde llegó. */
  quienAyer?: QuienLlego[];
  /** Cuentas de anuncios por aparato, acumulado (ver resumirDispositivos). */
  dispositivos?: ResumenDispositivos;
};

/** De dónde llegó, en un renglón: la campaña si la hay; si no, la fuente y lo que contestó. */
export function origenEnPalabras(o: Origen | null, comoNosConocio: string | null): string {
  const campana = campanaDe(o);
  const base = campana !== "—" ? `${campana} (${fuenteDe(o)})` : fuenteDe(o);
  return comoNosConocio && comoNosConocio !== "omitido" ? `${base}, dijo: ${comoNosConocio}` : base;
}

/** Una persona nueva, en lo que cabe en un renglón del correo. */
export type QuienLlego = {
  correo: string;
  /** "hombres-diario (google)", "directo", o lo que contestó en ¿cómo nos conociste? */
  origen: string;
  dispositivo: Dispositivo | null;
  /** Hasta dónde llegó, en palabras (pasoEnPalabras). */
  paso: string;
  prendas: number;
  fotos: number;
};

/**
 * Dónde se quedó, dicho como lo diría Roberto. `onboarding_step` es el paso que
 * le TOCA, así que "paso 2" significa "terminó colores y se quedó en el clóset".
 */
export function pasoEnPalabras(step: number, gender: string | null): string {
  if (!gender) return "se quedó en la primera pantalla (género)";
  if (step >= 5) return "llegó a su primer look";
  return (
    [
      "se quedó en los swipes",
      "se quedó en los colores",
      "se quedó en el clóset",
      "se quedó antes de pedir su look",
      "se quedó esperando su primer look",
    ][Math.max(0, step)] ?? "se quedó en el onboarding"
  );
}

export type ConteoDispositivo = { cuentas: number; primerLook: number };
export type ResumenDispositivos = Record<Dispositivo | "sinDato", ConteoDispositivo>;

/**
 * Cuántas cuentas de ANUNCIOS arrancaron en cada aparato y cuántas de ellas
 * llegaron a su primer look. Es la pregunta por la que las campañas incluyen
 * computadoras. "Sin dato" son las de antes del 2026-10-01 (no se guardaba).
 */
export function resumirDispositivos(
  filas: FilaPerfilAdquisicion[],
  extras: Map<string, ExtraCuenta>
): ResumenDispositivos {
  const r: ResumenDispositivos = {
    computadora: { cuentas: 0, primerLook: 0 },
    celular: { cuentas: 0, primerLook: 0 },
    tablet: { cuentas: 0, primerLook: 0 },
    sinDato: { cuentas: 0, primerLook: 0 },
  };
  for (const f of filas) {
    if (!esDeCampana(origenDesdeDato(f.origen))) continue;
    const g = r[extras.get(f.id)?.dispositivo ?? "sinDato"];
    g.cuentas++;
    if (f.onboarding_step >= 5) g.primerLook++;
  }
  return r;
}

/** "computadora 4 (2 con primer look) · celular 9 (5) · sin dato 1 (0)". Vacío si no hay nadie. */
export function textoDispositivos(r: ResumenDispositivos): string {
  const partes = (
    [
      ["computadora", r.computadora],
      ["celular", r.celular],
      ["tablet", r.tablet],
      ["sin dato", r.sinDato],
    ] as const
  )
    .filter(([, c]) => c.cuentas > 0)
    .map(([n, c], i) => `${n} ${c.cuentas} (${c.primerLook}${i === 0 ? " con primer look" : ""})`);
  return partes.join(" · ");
}

const usd = (n: number) => `$${n.toFixed(2)}`;
const mxn = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("es-MX")}`);
const pctTxt = (n: number, d: number) => (d === 0 ? "—" : `${Math.round((n / d) * 100)}%`);

/** Una pantalla de texto. Lo que no se manda no se mira; lo que es largo tampoco. */
export function correoDiario(d: DatosCorreoDiario): { subject: string; text: string } {
  const deCampana = d.campanas.filter((c) => c.campana !== "—" || c.costoMxn != null);
  const subject = `stailist · ${d.ayer}: ${usd(d.iaAyerUsd)} de IA · ${d.nuevasAyer} cuentas nuevas${
    d.nuevasAyerDeCampana ? ` (${d.nuevasAyerDeCampana} de anuncios)` : ""
  }`;
  const lineas = [
    `AYER (${d.ayer}, hora CDMX)`,
    `- IA: ${usd(d.iaAyerUsd)} en ${d.iaAyerLlamadas} llamadas${
      d.iaTop ? `; quien más gastó: ${d.iaTop.correo} (${usd(d.iaTop.usd)})` : ""
    }`,
    `- cuentas nuevas: ${d.nuevasAyer}, de anuncios: ${d.nuevasAyerDeCampana}, llegaron a su primer look: ${d.primerLookAyer}`,
    "",
    `CRITERIO DE PARO`,
    `- ${textoParo(d.paro)}`,
    "",
    ...(d.quienAyer?.length
      ? [
          "QUIÉN LLEGÓ AYER",
          ...d.quienAyer.map(
            (q) =>
              `- ${q.correo} · ${q.origen} · ${q.dispositivo ?? "aparato sin dato"} · ${q.paso} · ` +
              `${q.prendas} ${q.prendas === 1 ? "prenda" : "prendas"}${q.fotos ? ` (${q.fotos} de foto propia)` : ""}`
          ),
          "",
        ]
      : []),
    ...(d.dispositivos && textoDispositivos(d.dispositivos)
      ? ["POR APARATO (cuentas de anuncios, acumulado)", `- ${textoDispositivos(d.dispositivos)}`, ""]
      : []),
    ...(d.objetivos?.length ? [...d.objetivos, ""] : []),
  ];
  if (deCampana.length === 0) {
    lineas.push("CAMPAÑAS: todavía no hay nada con origen de campaña ni gasto capturado.");
  } else {
    lineas.push(`CAMPAÑAS (acumulado desde ${d.desde})`);
    for (const c of deCampana) {
      lineas.push(
        `- ${c.campana} (${c.fuente}): ${c.clics ?? "—"} clics, ${mxn(c.costoMxn)} MXN · ` +
          `pidieron código ${c.pidieronCodigo} · entraron ${c.entraron} · registro ${c.registro}` +
          `${c.registrosGoogle != null ? ` (Google dice ${c.registrosGoogle})` : ""} · ` +
          `primer look ${c.primerLook} · volvieron ${c.volvieron} de ${c.ventanaCerrada} (${pctTxt(c.volvieron, c.ventanaCerrada)}) · ` +
          `TTV ${fmtSegundos(c.ttvMedianaS)} · por primer look ${mxn(costoPor(c, c.primerLook))} MXN`
      );
    }
  }
  lineas.push("", "Panel: https://stailist.co/admin/campana");
  return { subject, text: lineas.join("\n") };
}

