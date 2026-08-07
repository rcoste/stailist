import type { BriefMotor } from "@/lib/comparador/motor";
import type { LookMotor } from "@/lib/comparador/motor";
import type { NotaRubrica, EstiloRubrica, ColorRubrica } from "@/lib/engine/rubrica";
import { seasonPalette, normSeason, SEASONS, type Season } from "@/lib/colorimetria";
import type { Violacion } from "@/lib/engine/reglas-ejecucion";
import { costoUsd } from "@/lib/proveedores/precios";
import { MODELO_MOTOR, JUDGE_MODEL, VISION_MODEL } from "@/lib/models";
import { styleReferenceForEngine } from "@/lib/estilo-referencia";
import { variedadDeGestos, type VariedadGestos } from "@/lib/engine/gestos";

// EL EVAL, lo puro: tipos, marcador, acuerdo de calibración y estimado.
//
// Es la banda de medir del motor (el comparador es la balanza): una corrida
// genera el pool congelado con el motor VIGENTE y lo califican los jueces
// automáticos — reglas de código, rúbrica de texto, rúbrica de visión. El
// resultado queda clavado a {prompt_version, modelo, pool, rúbricas} y la
// lista de corridas es la curva: ¿el motor de hoy es mejor que el del mes
// pasado? Como los benchmarks internos de los labs, con su misma advertencia:
// un juez contra el que se optimiza deja de medir. Por eso el marcador
// automático NUNCA sustituye la calibración humana — la re-mide (ver
// acuerdoDeCalibracion).

/** Las notas de los tres jueces para UN look, en el orden de `looks`. */
export type NotaDeLook = {
  /** Reglas de código violadas (aritmética, no opinión). */
  violaciones: Violacion[];
  /** La rúbrica de texto (lee nombres). null = ese juez falló; se reintenta. */
  texto: NotaRubrica | null;
  /** La rúbrica visual (ve las fotos). null = falló; se reintenta. */
  vision: NotaRubrica | null;
};

export type EvalBriefFila = {
  id: string;
  n: number;
  brief: BriefMotor;
  looks: LookMotor[] | null;
  reviews: { changed?: boolean; verdict?: string }[] | null;
  error: string | null;
  costoGenUsd: number | null;
  msGen: number | null;
  notas: NotaDeLook[] | null;
  costoNotasUsd: number | null;
  /** Calibración humana: {"<índice de look>": "arriba" | "abajo"}. */
  marcas: Record<string, string> | null;
  comentarios: Record<string, string> | null;
};

export type EvalCorrida = {
  id: string;
  creada: string;
  promptVersion: string;
  poolVersion: string;
  modeloGenerador: string;
  modeloJuez: string;
  rubricaVersion: string;
  rubricaVisionVersion: string;
  conEstilo: boolean;
  /** Si el perfil tenía colorimetría al abrir la corrida (misma lógica que
   * conEstilo: sin ella el juez pone 3 neutro y promediarlo no mide nada). */
  conColor: boolean;
  estado: string;
  nota: string | null;
};

/** La paleta del perfil en los mismos tres grupos que consume el motor. */
export function colorDelPerfil(profile: Record<string, unknown>): ColorRubrica {
  const season = profile.palette_season as Season | null;
  const flow = profile.palette_flow as Season | null;
  if (!season) return { estacion: null, mejores: [], prestados: [], evita: [] };
  const p = seasonPalette(season, flow);
  const key = normSeason(season);
  return {
    estacion: (key && SEASONS[key]?.label) || season,
    mejores: p.mejores.map((c) => ({ nombre: c.nombre, hex: c.hex })),
    prestados: p.prestados.map((c) => ({ nombre: c.nombre, hex: c.hex })),
    evita: p.evita.map((c) => ({ nombre: c.nombre, hex: c.hex })),
  };
}

/** El estilo del perfil en las MISMAS líneas que consume el motor. */
export function estiloDelPerfil(profile: Record<string, unknown>): EstiloRubrica {
  const arq = profile.style_archetype as { nombre?: string; descripcion?: string } | null;
  return {
    marca: styleReferenceForEngine(profile.style_reference),
    palabras: (profile.style_words as string | null)?.trim() || null,
    arquetipo: arq?.nombre
      ? `${arq.nombre}${arq.descripcion ? ` — ${arq.descripcion}` : ""}`
      : null,
  };
}

// ── Qué falta por hacer (la fase se decide por los DATOS, como el comparador) ──

/** ¿Este brief ya tiene todo? Generado (o con error terminal) y calificado. */
export function briefCompleto(f: EvalBriefFila): boolean {
  if (f.error) return true; // un motor que truena ES un resultado
  if (!f.looks) return false;
  if (f.looks.length === 0) return true;
  const notas = f.notas ?? [];
  return (
    notas.length >= f.looks.length &&
    f.looks.every((_, i) => notas[i] && notas[i].texto && notas[i].vision)
  );
}

export function briefsPendientes(filas: EvalBriefFila[]): EvalBriefFila[] {
  return filas.filter((f) => !briefCompleto(f));
}

// ── El marcador ────────────────────────────────────────────────────────────

export type PromediosDim = {
  ocasion: number | null;
  clima: number | null;
  armado: number | null;
  estilo: number | null;
  color: number | null;
  wow: number | null;
};

export type MarcadorEval = {
  briefs: number;
  briefsGenerados: number;
  errores: number;
  looks: number;
  looksCalificados: number;
  /** Promedios 1-5 por dimensión, por juez. `estilo` va null si la corrida no
   * tenía señal de estilo (el 3 neutro no mide nada). */
  texto: PromediosDim;
  vision: PromediosDim;
  aprobadoTexto: { si: number; de: number };
  aprobadoVision: { si: number; de: number };
  violaciones: { total: number; looksConViolacion: number; porRegla: Record<string, number> };
  /** El juez de producción: cuánto reparó/rechazó. Cuando esto tienda a cero,
   * es la señal de que las rueditas ya no se tocan. */
  reparacion: { candidatos: number; reparados: number; rechazados: number };
  costoGenPromedio: number | null;
  msGenPromedio: number | null;
  costoTotal: number;
  /**
   * La VARIEDAD de gestos de styling. Es la métrica primaria del wow y la única
   * de este marcador que no depende de un juez: se cuenta sobre el texto que el
   * motor produjo, así que optimizar el prompt contra ella no la corrompe.
   */
  gestos: VariedadGestos;
};

const promedio = (xs: number[]): number | null =>
  xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null;

export function marcadorEval(
  filas: EvalBriefFila[],
  conEstilo: boolean,
  conColor = true
): MarcadorEval {
  const dims = ["ocasion", "clima", "armado", "estilo", "color", "wow"] as const;
  const vacio = () =>
    ({ ocasion: [], clima: [], armado: [], estilo: [], color: [], wow: [] }) as Record<
      string,
      number[]
    >;
  const acc = { texto: vacio(), vision: vacio() };
  let looks = 0;
  let looksCalificados = 0;
  const aprobadoTexto = { si: 0, de: 0 };
  const aprobadoVision = { si: 0, de: 0 };
  const violaciones = { total: 0, looksConViolacion: 0, porRegla: {} as Record<string, number> };
  const reparacion = { candidatos: 0, reparados: 0, rechazados: 0 };
  const costos: number[] = [];
  const tiempos: number[] = [];
  let costoTotal = 0;

  for (const f of filas) {
    if (f.costoGenUsd != null) {
      costos.push(f.costoGenUsd);
      costoTotal += f.costoGenUsd;
    }
    if (f.costoNotasUsd != null) costoTotal += f.costoNotasUsd;
    if (f.msGen != null) tiempos.push(f.msGen);
    for (const r of f.reviews ?? []) {
      reparacion.candidatos++;
      if (r.verdict === "rechazado") reparacion.rechazados++;
      else if (r.changed) reparacion.reparados++;
    }
    looks += f.looks?.length ?? 0;
    (f.notas ?? []).forEach((nota, i) => {
      if (!f.looks?.[i] || !nota) return;
      if (nota.texto && nota.vision) looksCalificados++;
      for (const v of nota.violaciones ?? []) {
        violaciones.total++;
        violaciones.porRegla[v.regla] = (violaciones.porRegla[v.regla] ?? 0) + 1;
      }
      if ((nota.violaciones ?? []).length > 0) violaciones.looksConViolacion++;
      if (nota.texto) {
        aprobadoTexto.de++;
        if (nota.texto.aprobado) aprobadoTexto.si++;
        for (const d of dims) {
          const n = nota.texto[d];
          if (typeof n === "number") acc.texto[d].push(n);
        }
      }
      if (nota.vision) {
        aprobadoVision.de++;
        if (nota.vision.aprobado) aprobadoVision.si++;
        for (const d of dims) {
          const n = nota.vision[d];
          if (typeof n === "number") acc.vision[d].push(n);
        }
      }
    });
  }

  const armarDims = (de: Record<string, number[]>): PromediosDim => ({
    ocasion: promedio(de.ocasion),
    clima: promedio(de.clima),
    armado: promedio(de.armado),
    // Sin señal de estilo el juez pone 3 neutro: promediarlo diría "3.0" con
    // cara de medición cuando no midió nada. Igual con la colorimetría.
    estilo: conEstilo ? promedio(de.estilo) : null,
    color: conColor ? promedio(de.color) : null,
    wow: promedio(de.wow),
  });

  return {
    briefs: filas.length,
    briefsGenerados: filas.filter((f) => f.looks || f.error).length,
    errores: filas.filter((f) => f.error).length,
    looks,
    looksCalificados,
    texto: armarDims(acc.texto),
    vision: armarDims(acc.vision),
    aprobadoTexto,
    aprobadoVision,
    violaciones,
    reparacion,
    costoGenPromedio: promedio(costos),
    msGenPromedio: tiempos.length
      ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)
      : null,
    costoTotal: Math.round(costoTotal * 10000) / 10000,
    gestos: variedadDeGestos(filas.flatMap((f) => (f.looks ?? []).map((l) => l.tip))),
  };
}

// ── La calibración: ¿las rúbricas siguen viendo como el humano? ────────────

export type AcuerdoCapa = { aciertos: number; de: number };

export type AcuerdoCalibracion = {
  marcados: number;
  /** aprobado del juez == 👍 del humano. */
  texto: AcuerdoCapa;
  vision: AcuerdoCapa;
  /** El código solo predice 👎 (violación ⇒ abajo): se mide sobre sus alarmas. */
  codigo: { alarmas: number; conAbajo: number };
  /** De los 👎 humanos, cuántos caza cada capa — la cobertura que importa. */
  abajos: { total: number; cazaTexto: number; cazaVision: number; cazaCodigo: number };
};

export function acuerdoDeCalibracion(filas: EvalBriefFila[]): AcuerdoCalibracion {
  const r: AcuerdoCalibracion = {
    marcados: 0,
    texto: { aciertos: 0, de: 0 },
    vision: { aciertos: 0, de: 0 },
    codigo: { alarmas: 0, conAbajo: 0 },
    abajos: { total: 0, cazaTexto: 0, cazaVision: 0, cazaCodigo: 0 },
  };
  for (const f of filas) {
    for (const [idx, marca] of Object.entries(f.marcas ?? {})) {
      if (marca !== "arriba" && marca !== "abajo") continue;
      const nota = f.notas?.[Number(idx)];
      if (!nota) continue;
      r.marcados++;
      const humanoAprueba = marca === "arriba";
      if (nota.texto) {
        r.texto.de++;
        if (nota.texto.aprobado === humanoAprueba) r.texto.aciertos++;
      }
      if (nota.vision) {
        r.vision.de++;
        if (nota.vision.aprobado === humanoAprueba) r.vision.aciertos++;
      }
      const conViolacion = (nota.violaciones ?? []).length > 0;
      if (conViolacion) {
        r.codigo.alarmas++;
        if (!humanoAprueba) r.codigo.conAbajo++;
      }
      if (!humanoAprueba) {
        r.abajos.total++;
        if (nota.texto && !nota.texto.aprobado) r.abajos.cazaTexto++;
        if (nota.vision && !nota.vision.aprobado) r.abajos.cazaVision++;
        if (conViolacion) r.abajos.cazaCodigo++;
      }
    }
  }
  return r;
}

// ── El estimado, antes de gastar ───────────────────────────────────────────

/**
 * Lo que cuesta una corrida de eval de `nBriefs`. Tamaños medidos del
 * comparador (motor ~20k entrada / 2.5k salida por generación, juez de
 * producción ~20k/800 × 3) más los jueces del eval por look: la rúbrica de
 * texto es chica (~2k/700) y la visual manda ~5 fotos (~4k/700 en el modelo
 * de visión, que es centavos).
 */
export function estimadoEval(nBriefs: number): number | null {
  const gen = costoUsd(MODELO_MOTOR.id, { entrada: 20000, salida: 2500 });
  const juezProd = costoUsd(JUDGE_MODEL, { entrada: 20000, salida: 800 });
  const texto = costoUsd(JUDGE_MODEL, { entrada: 2000, salida: 700 });
  const vision = costoUsd(VISION_MODEL.id, { entrada: 4000, salida: 700 });
  if (gen === null || juezProd === null || texto === null || vision === null) return null;
  const porBrief = gen + 3 * juezProd + 3 * (texto + vision);
  return porBrief * nBriefs;
}
