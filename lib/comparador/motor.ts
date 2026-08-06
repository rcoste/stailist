import type { OpcionesGeneracion } from "@/lib/engine/generate";
import type { Modelo } from "@/lib/proveedores";
import type { Weather } from "@/lib/weather";
import { costoUsd } from "@/lib/proveedores/precios";
import { RETADOR_MOTOR } from "@/lib/proveedores/catalogo";
import { JUDGE_MODEL, ENGINE_MODEL } from "@/lib/models";

// Lo puro del comparador de MOTORES: variantes, briefs, ciego, marcador y
// estimado. Sin tocar la base (eso vive en motor-servidor.ts) para que las
// pantallas del cliente puedan importarlo sin arrastrar el servidor.

export type TamanoCorrida = "vistazo" | "veredicto";

/**
 * Una variante del motor: {modelo + reglas encendidas}. El prompt es el
 * vigente (PROMPT_VERSION se congela en la corrida al crearla).
 *
 * `opciones` son los MISMOS flags que ya existen en el motor para el arnés
 * (sinBlueprint, marcarEstilo…): apagar una regla es correr el motor real con
 * ese flag, no una imitación.
 */
export type VarianteMotor = {
  clave: string;
  etiqueta: string;
  /** Qué es esta variante, en una línea, para la pantalla. */
  ayuda: string;
  /** id del catálogo de proveedores. Ausente = el motor de producción. */
  modeloId?: string;
  opciones?: Omit<OpcionesGeneracion, "modelo" | "blueprint">;
};

/**
 * La banca de variantes. "produccion" siempre es el control: el motor tal cual
 * corre hoy. Las demás apagan UNA cosa o cambian SOLO el modelo — una variante
 * que cambiara dos cosas a la vez no diría cuál causó la diferencia.
 */
export const VARIANTES_MOTOR: VarianteMotor[] = [
  {
    clave: "produccion",
    etiqueta: "Producción",
    ayuda: "el motor tal cual corre hoy (control)",
  },
  {
    clave: "sonnet",
    etiqueta: "Sonnet 5",
    ayuda: "mismo prompt y reglas, generador en Sonnet (2.5× más barato)",
    modeloId: RETADOR_MOTOR,
  },
  {
    clave: "sin-marca-estilo",
    etiqueta: "Sin marca de estilo",
    ayuda: "el clóset sin marcar qué prendas son del vocabulario de su familia",
    opciones: { marcarEstilo: false },
  },
  {
    clave: "sin-blueprint",
    etiqueta: "Sin estructura de referencia",
    ayuda: "sin el look de calle diseccionado (v35)",
    opciones: { sinBlueprint: true },
  },
  {
    clave: "sin-rotacion",
    etiqueta: "Sin rotación",
    ayuda: "sin el historial por prenda (v36): solo no-repetir combos",
    opciones: { sinRotacion: true },
  },
  {
    clave: "sin-neutros",
    etiqueta: "Sin neutros-como-fondo",
    ayuda: "sin la aclaración de que los neutros no compiten con la paleta (v37)",
    opciones: { sinNeutros: true },
  },
];

export function variantePorClave(clave: string): VarianteMotor | null {
  return VARIANTES_MOTOR.find((v) => v.clave === clave) ?? null;
}

/** Un brief: el día que las dos variantes tienen que resolver. */
export type BriefMotor = {
  etiqueta: string;
  objective: string;
  momento: "dia" | "noche" | null;
  weather: Weather | null;
};

const CLIMAS = {
  frio: { temp_c: 8, condition: "despejado" },
  templado: { temp_c: 18, condition: "nublado" },
  calor: { temp_c: 29, condition: "soleado" },
  lluvia: { temp_c: 17, condition: "lluvia" },
} as const;

/**
 * El pool de briefs, fijo y en este orden a propósito: la misma corrida dentro
 * de tres meses (contra un modelo nuevo) verá los MISMOS días. Los primeros 6
 * son el vistazo; el veredicto cicla el pool completo.
 *
 * Cubre lo que el motor tiene que saber resolver: las tres ocasiones con piso
 * de formalidad distinto (diario sin piso, oficina, evento/noche) por las
 * cuatro bandas de clima que cambian el clóset disponible.
 */
const POOL_BRIEFS: BriefMotor[] = [
  { etiqueta: "diario · templado", objective: "diario", momento: "dia", weather: CLIMAS.templado },
  { etiqueta: "oficina · templado", objective: "oficina", momento: "dia", weather: CLIMAS.templado },
  { etiqueta: "evento · noche templada", objective: "evento", momento: "noche", weather: CLIMAS.templado },
  { etiqueta: "diario · frío", objective: "diario", momento: "dia", weather: CLIMAS.frio },
  { etiqueta: "oficina · calor", objective: "oficina", momento: "dia", weather: CLIMAS.calor },
  { etiqueta: "diario · lluvia", objective: "diario", momento: "dia", weather: CLIMAS.lluvia },
  { etiqueta: "evento · noche fría", objective: "evento", momento: "noche", weather: CLIMAS.frio },
  { etiqueta: "diario · calor", objective: "diario", momento: "dia", weather: CLIMAS.calor },
  { etiqueta: "oficina · frío", objective: "oficina", momento: "dia", weather: CLIMAS.frio },
  { etiqueta: "aeropuerto · templado", objective: "viaje", momento: "dia", weather: CLIMAS.templado },
];

export const N_VISTAZO = 6;
export const MIN_VEREDICTO = 20;
export const MAX_VEREDICTO = 40;

export function briefsPara(tamano: TamanoCorrida, n: number): BriefMotor[] {
  const total = tamano === "vistazo" ? N_VISTAZO : n;
  return Array.from({ length: total }, (_, i) => {
    const b = POOL_BRIEFS[i % POOL_BRIEFS.length];
    const vuelta = Math.floor(i / POOL_BRIEFS.length);
    return vuelta === 0 ? b : { ...b, etiqueta: `${b.etiqueta} (${vuelta + 1}ª)` };
  });
}

/**
 * Cuántos pares espejo lleva un veredicto (~10%, mínimo 2). Repiten looks ya
 * generados con el orden invertido: miden si el voto sobrevive al espejo, y
 * cuestan $0 porque no generan nada.
 */
export function nRepetidos(tamano: TamanoCorrida, n: number): number {
  if (tamano === "vistazo") return 0;
  return Math.max(2, Math.round(n * 0.1));
}

/**
 * Los defectos que se pueden marcar por lado al votar. Es la cosecha del
 * vistazo: cada tag confirmado es candidato a regla comprobable en código
 * (lib/engine/reglas-ejecucion.ts) — el camino nota→regla que hasta hoy se
 * quedaba en la cabeza de quien califica.
 */
export const DEFECTOS_MOTOR = [
  { clave: "clima", label: "rompe el clima" },
  { clave: "ocasion", label: "mal para la ocasión" },
  { clave: "color", label: "color que choca" },
  { clave: "proporcion", label: "proporción rara" },
  { clave: "capas", label: "capas que nadie usa" },
  { clave: "repetido", label: "repetitivo entre sí" },
  { clave: "plano", label: "correcto pero plano" },
] as const;

/**
 * EL CIEGO. Determinista por par (recargar no cambia columnas): decide si el
 * par muestra [variante0, variante1] o al revés. Mismo hash FNV que el
 * comparador de visión.
 */
export function ladoInvertido(parId: string): boolean {
  let h = 2166136261;
  for (let i = 0; i < parId.length; i++) {
    h ^= parId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return (h & 1) === 1;
}

/**
 * El orden en que la pantalla muestra las variantes de UN par — y el ÚNICO
 * lugar donde se calcula. La pantalla lo usa para pintar y votarParMotor para
 * deshacer el ciego: si vivieran como dos copias (así nació) y una cambiara,
 * los votos se atribuirían a la variante equivocada en silencio.
 *
 * El espejo va SIEMPRE al revés que su original — no un sorteo nuevo: si se
 * sorteara, la mitad de los espejos quedarían en el mismo orden y no medirían
 * nada.
 */
export function ordenDelPar(
  parId: string,
  repiteDe: string | null,
  claves: [string, string]
): [string, string] {
  const invertido = repiteDe ? !ladoInvertido(repiteDe) : ladoInvertido(parId);
  return invertido ? [claves[1], claves[0]] : claves;
}

/**
 * Traduce una variante congelada a las opciones reales de armarLooks.
 * null si su modeloId ya no existe en el catálogo (corrida vieja contra un
 * catálogo que cambió — mejor un error claro que caer a producción en
 * silencio). Compartida por la ruta de generación y el smoke: dos copias de
 * este spread es exactamente la deriva de arnés que este proyecto ya pagó.
 */
export function opcionesDeVariante(
  v: VarianteMotor,
  modeloPorId: (id: string) => Modelo | null
): OpcionesGeneracion | null {
  const modelo = v.modeloId ? modeloPorId(v.modeloId) : null;
  if (v.modeloId && !modelo) return null;
  return {
    ...(v.opciones ?? {}),
    ...(modelo ? { modelo } : {}),
  };
}

// ── Lo guardado ────────────────────────────────────────────────────────────

export type LookMotor = {
  nombre: string;
  item_ids: string[];
  explicacion: string;
  tip?: string | null;
};

export type LadoMotor = {
  variante: string;
  looks: LookMotor[] | null;
  reviews: unknown;
  error: string | null;
  costoUsd: number | null;
  ms: number | null;
};

export type ParMotor = {
  id: string;
  n: number;
  brief: BriefMotor;
  repiteDe: string | null;
  voto: string | null; // clave de variante o 'empate'
  defectos: Record<string, string[]> | null;
  nota: string | null;
  lados: LadoMotor[];
};

// ── El marcador ────────────────────────────────────────────────────────────

export type ResultadoVariante = {
  clave: string;
  etiqueta: string;
  victorias: number;
  defectos: Record<string, number>;
  costoPromedio: number | null;
  msPromedio: number | null;
  errores: number;
};

export type MarcadorMotor = {
  variantes: ResultadoVariante[];
  empates: number;
  votados: number; // pares reales (sin espejos) con voto
  /** p del sign test (dos colas) sobre victorias A vs B. null si no hay votos. */
  p: number | null;
  /** Espejos votados y cuántos coincidieron con su original. */
  consistencia: { espejos: number; coinciden: number };
};

/** Sign test exacto de dos colas: ¿este marcador puede ser puro azar? */
export function pBinomial(a: number, b: number): number | null {
  const n = a + b;
  if (n === 0) return null;
  const k = Math.max(a, b);
  // P(X >= k) con X ~ Bin(n, 0.5), por coeficientes exactos.
  let cola = 0;
  for (let i = k; i <= n; i++) cola += binom(n, i);
  const p = 2 * cola * Math.pow(0.5, n);
  return Math.min(1, p);
}

function binom(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

export function marcadorMotor(
  variantes: { clave: string; etiqueta: string }[],
  pares: ParMotor[]
): MarcadorMotor {
  const acc = new Map<string, ResultadoVariante & { costoSuma: number; costoN: number; msSuma: number; msN: number }>();
  for (const v of variantes) {
    acc.set(v.clave, {
      clave: v.clave,
      etiqueta: v.etiqueta,
      victorias: 0,
      defectos: {},
      costoPromedio: null,
      msPromedio: null,
      errores: 0,
      costoSuma: 0,
      costoN: 0,
      msSuma: 0,
      msN: 0,
    });
  }

  let empates = 0;
  let votados = 0;
  const reales = pares.filter((p) => !p.repiteDe);
  const porId = new Map(pares.map((p) => [p.id, p]));

  for (const par of reales) {
    for (const lado of par.lados) {
      const a = acc.get(lado.variante);
      if (!a) continue;
      if (lado.error) a.errores++;
      if (lado.costoUsd != null) {
        a.costoSuma += lado.costoUsd;
        a.costoN++;
      }
      if (lado.ms != null) {
        a.msSuma += lado.ms;
        a.msN++;
      }
    }
    if (par.voto == null) continue;
    votados++;
    if (par.voto === "empate") empates++;
    else acc.get(par.voto) && acc.get(par.voto)!.victorias++;
  }

  // Los defectos se cosechan de TODOS los pares votados, espejos incluidos:
  // un espejo no suma victorias (repite looks), pero lo que Roberto marcó ahí
  // es una observación tan válida como cualquiera — tirarla sería perder ~10%
  // del etiquetado del veredicto en silencio.
  for (const par of pares) {
    if (par.voto == null) continue;
    for (const [clave, tags] of Object.entries(par.defectos ?? {})) {
      const a = acc.get(clave);
      if (!a) continue;
      for (const t of tags) a.defectos[t] = (a.defectos[t] ?? 0) + 1;
    }
  }

  // Los espejos: ¿el voto sobrevivió a invertir el orden?
  let espejos = 0;
  let coinciden = 0;
  for (const par of pares) {
    if (!par.repiteDe || par.voto == null) continue;
    const original = porId.get(par.repiteDe);
    if (!original || original.voto == null) continue;
    espejos++;
    if (original.voto === par.voto) coinciden++;
  }

  const [va, vb] = [...acc.values()];
  return {
    variantes: [...acc.values()].map((a) => ({
      clave: a.clave,
      etiqueta: a.etiqueta,
      victorias: a.victorias,
      defectos: a.defectos,
      costoPromedio: a.costoN ? a.costoSuma / a.costoN : null,
      msPromedio: a.msN ? Math.round(a.msSuma / a.msN) : null,
      errores: a.errores,
    })),
    empates,
    votados,
    p: va && vb ? pBinomial(va.victorias, vb.victorias) : null,
    consistencia: { espejos, coinciden },
  };
}

// ── El estimado ────────────────────────────────────────────────────────────

/**
 * Lo que costaría la corrida ANTES de lanzarla. Tamaños MEDIDOS de una corrida
 * real del pipeline completo sobre el clóset de Roberto (113 prendas,
 * 2026-08-05): ~82k tokens repartidos en 4 llamadas — el prompt del motor y el
 * del juez entran en ~20k cada uno. Se toma el caso caro (3 jueces, salida
 * llena) para que el estimado nunca quede corto: el real de esa corrida fue
 * $0.25/lado con Opus contra $0.31 estimado.
 *
 * Los pares espejo no se cuentan: reusan looks ya generados.
 */
export function estimadoMotor(
  claves: string[],
  nPares: number
): number | null {
  let porPar = 0;
  for (const clave of claves) {
    const v = variantePorClave(clave);
    if (!v) return null;
    const gen = costoUsd(v.modeloId ?? ENGINE_MODEL, { entrada: 20000, salida: 2500 });
    const juez = costoUsd(JUDGE_MODEL, { entrada: 20000, salida: 800 });
    if (gen === null || juez === null) return null;
    porPar += gen + 3 * juez;
  }
  return porPar * nPares;
}
