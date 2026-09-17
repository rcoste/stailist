// "ARMA MI SEMANA" — la lógica sin red: qué días se ofrecen, qué se acepta y
// cuándo no alcanza el clóset.
//
// Nació del assessment de Aesty (2026-09-16) y de Ricardo, que ya le pedía a
// un chatbot "estos son mis clósets, armame la semana": la gente planea por
// semana, y pedir un look por día la obliga a volver siete veces a hacer lo
// mismo. Cada día se guarda como un look PLANEADO (outfits.planned_for), así
// que al amanecer promoverPlaneado lo vuelve "tu look de hoy" sin generar nada.
//
// Decisiones de Roberto (2026-09-16):
// · los siguientes 7 días a partir de MAÑANA (hoy ya tiene su look), con lunes
//   a viernes marcados y el fin de semana a un toque — es otro plan y no hay
//   que gastar looks que nadie pidió;
// · cada día con un plan de un toque y un buen default (ver PLANES_SEMANA).
//   Pedir detalle obligatorio convierte la pantalla en un formulario;
// · mínimo de prendas: con poca ropa, cinco looks seguidos salen repetidos y
//   la función se quema la primera vez que alguien la usa.


/** Cuántos días hacia adelante se ofrecen (sin contar hoy). */
export const DIAS_SEMANA = 7;

/**
 * Prendas mínimas en el clóset. No distingue básicos marcados de fotos: un
 * básico marcado ES ropa que la persona tiene. Lo que cuenta es la variedad
 * para no repetir el mismo conjunto cinco días.
 */
export const MIN_PRENDAS_SEMANA = 10;

/**
 * LOS PLANES DE UN DÍA (2026-09-16). La primera versión sólo tenía "día a día"
 * y "trabajo", y Roberto la vio corta: "no especifica qué tipo de outfit, si
 * con cliente o no, e igual no me queda claro qué pasa los fines de semana".
 * Una stylist no pregunta "¿trabajas?": pregunta "¿qué te toca ese día?".
 *
 * TODO LO DE AQUÍ YA LO SABE EL MOTOR — la regla es que ningún cambio del
 * motor sale sin medir, así que esta lista sólo usa entradas que ya existen y
 * ya se midieron por el wizard de "crear un look":
 * · "con cliente" es el `veCliente` del código "depende del día"
 *   (VARIABLE_HOY en lib/dress-code). En los otros tres códigos el motor no
 *   tiene texto de "hoy ve cliente", así que ahí NO se ofrece — escribirlo es
 *   un cambio de prompt y va con medición.
 * · Las comidas, cenas, cita y fiesta son el catálogo de lib/eventos, con la
 *   misma regla que el wizard: sin formalidad declarada (son de norma, no de
 *   código). Boda, graduación y funeral NO: tienen invitación o código y el
 *   clóset puede no alcanzar; para eso está "crear un look", que pregunta.
 * · Home office y día de pendientes quedan fuera: el motor no tiene su texto.
 *
 * `id` es lo que viaja y se guarda (outfits.plan_semana). "diario" y "oficina"
 * conservan el id de la primera versión: un cliente viejo que mande
 * `ocasion: "oficina"` sigue siendo válido.
 */
export type PlanSemana = {
  id: string;
  label: string;
  objective: "diario" | "oficina" | "evento";
  tipoEvento?: string;
  momento?: "dia" | "noche";
  veCliente?: boolean;
  /** Sólo tiene sentido si el código de trabajo es "depende del día". */
  soloCodigoVariable?: boolean;
};

export const PLANES_SEMANA = [
  { id: "oficina", label: "trabajo", objective: "oficina", veCliente: false },
  { id: "cliente", label: "con cliente", objective: "oficina", veCliente: true, soloCodigoVariable: true },
  { id: "comida-trabajo", label: "comida de trabajo", objective: "evento", tipoEvento: "comida-trabajo", momento: "dia" },
  { id: "diario", label: "día a día", objective: "diario" },
  { id: "comida-familiar", label: "comida familiar", objective: "evento", tipoEvento: "comida-familiar", momento: "dia" },
  { id: "cena-amigos", label: "cena con amigos", objective: "evento", tipoEvento: "cena-amigos", momento: "noche" },
  { id: "cita", label: "una cita", objective: "evento", tipoEvento: "cita", momento: "noche" },
  { id: "fiesta", label: "una fiesta", objective: "evento", tipoEvento: "fiesta", momento: "noche" },
] as const satisfies ReadonlyArray<PlanSemana>;

export type PlanSemanaId = (typeof PLANES_SEMANA)[number]["id"];
/** @deprecated nombre de la primera versión; hoy es el id del plan. */
export type OcasionSemana = PlanSemanaId;

export function planPorId(id: string | null | undefined): PlanSemana | null {
  return PLANES_SEMANA.find((p) => p.id === id) ?? null;
}

/**
 * Qué planes se ofrecen y en qué orden. Entre semana y en fin de semana son
 * días distintos: el lunes el trabajo va primero y no hay "fiesta"; el sábado
 * no hay "trabajo" y sí comida familiar.
 */
export function planesDelDia(finDeSemana: boolean, codigoTrabajo: string | null): PlanSemana[] {
  const orden: PlanSemanaId[] = finDeSemana
    ? ["diario", "comida-familiar", "cena-amigos", "cita", "fiesta"]
    : ["oficina", "cliente", "comida-trabajo", "diario", "cena-amigos", "cita"];
  return orden
    .map((id) => planPorId(id)!)
    .filter((p) => !p.soloCodigoVariable || codigoTrabajo === "variable");
}

/**
 * El plan con que arranca un día. Entre semana, trabajo si ya dijo cómo se
 * viste para trabajar (trabaja); si no, día a día — no se le asume un empleo.
 * El fin de semana arranca apagado, así que su plan sólo importa al marcarlo.
 */
export function planInicial(finDeSemana: boolean, codigoTrabajo: string | null): PlanSemanaId {
  return !finDeSemana && codigoTrabajo ? "oficina" : "diario";
}

/**
 * Lo que recibe el núcleo (generateInto) para armar un día. Es la misma forma
 * que manda el wizard: evento con su tipo y SIN formalidad; trabajo con
 * `veCliente` (el motor lo ignora salvo en el código "depende del día").
 */
export function cuerpoDelPlan(id: string | null | undefined) {
  const p = planPorId(id) ?? planPorId("diario")!;
  return {
    objective: p.objective,
    ...(p.tipoEvento ? { tipoEvento: p.tipoEvento } : {}),
    ...(p.momento ? { momento: p.momento } : {}),
    ...(typeof p.veCliente === "boolean" ? { veCliente: p.veCliente } : {}),
  };
}

export type DiaOfrecido = {
  /** YYYY-MM-DD */
  fecha: string;
  /** "lun", "mar"… */
  dia: string;
  /** Día del mes, para la etiqueta. */
  numero: number;
  finDeSemana: boolean;
};

/** `ocasion` guarda el id del plan (el nombre del campo es de la v1). */
export type DiaPedido = { fecha: string; ocasion: PlanSemanaId };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOMBRES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function sumarDias(fecha: string, n: number): string {
  const d = new Date(fecha + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Los 7 días que se ofrecen, empezando mañana respecto a la fecha LOCAL. */
export function diasOfrecidos(hoyLocal: string): DiaOfrecido[] {
  return Array.from({ length: DIAS_SEMANA }, (_, i) => {
    const fecha = sumarDias(hoyLocal, i + 1);
    const d = new Date(fecha + "T12:00:00Z");
    const semana = d.getUTCDay();
    return {
      fecha,
      dia: NOMBRES[semana],
      numero: d.getUTCDate(),
      finDeSemana: semana === 0 || semana === 6,
    };
  });
}

function esOcasion(v: unknown): v is PlanSemanaId {
  return typeof v === "string" && planPorId(v) !== null;
}

export type Validacion =
  | { ok: true; dias: DiaPedido[] }
  | { ok: false; error: "sin_dias" | "dias_invalidos" };

/**
 * Lo que llega del cliente, validado contra los días que de verdad se ofrecen
 * hoy. Un día repetido, fuera de la ventana o con ocasión desconocida invalida
 * la petición entera: es un cliente roto, no una persona, y armar a medias
 * sería peor que decir que no.
 */
export function validarPeticion(dias: unknown, hoyLocal: string): Validacion {
  if (!Array.isArray(dias) || dias.length === 0) return { ok: false, error: "sin_dias" };
  if (dias.length > DIAS_SEMANA) return { ok: false, error: "dias_invalidos" };
  const validas = new Set(diasOfrecidos(hoyLocal).map((d) => d.fecha));
  const vistas = new Set<string>();
  const salida: DiaPedido[] = [];
  for (const d of dias) {
    const fecha = (d as { fecha?: unknown })?.fecha;
    const ocasion = (d as { ocasion?: unknown })?.ocasion;
    if (typeof fecha !== "string" || !DATE_RE.test(fecha)) return { ok: false, error: "dias_invalidos" };
    if (!validas.has(fecha) || vistas.has(fecha) || !esOcasion(ocasion)) {
      return { ok: false, error: "dias_invalidos" };
    }
    vistas.add(fecha);
    salida.push({ fecha, ocasion });
  }
  // En orden de calendario: el motor arma cada día viendo los anteriores, así
  // que el orden decide quién "se queda" con la combinación favorita.
  salida.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { ok: true, dias: salida };
}

/**
 * Un look en fila todavía no empezó a generarse, pero su fila ya existe (se
 * crean todas al pedir para que un doble toque no duplique la semana). Su
 * reloj de "muerto" arranca cuando le toca su turno: ver app/api/semana.
 */
export const ESTADOS_DIA = ["en_fila", "generando", "listo", "error"] as const;
export type EstadoDia = (typeof ESTADOS_DIA)[number];

/** Marca en gen_error de un día que todavía espera su turno (ver app/api/semana). */
export const EN_FILA = "en_fila";

/**
 * El estado de un día a partir de su fila. Lo usan el GET (qué pintar) y el
 * POST (qué fechas ya están ocupadas): si decidieran distinto, un día colgado
 * se vería como error pero bloquearía volver a pedirlo para siempre.
 */
export function estadoDelDia(
  fila: { gen_status: string | null; gen_error: string | null; created_at: string },
  ahora: number,
  staleMs: number
): EstadoDia {
  const st = fila.gen_status ?? "ready";
  if (st === "ready") return "listo";
  const edad = ahora - new Date(fila.created_at).getTime();
  // En fila no muere por edad: si el proceso que la corría se cortó, la
  // siguiente lectura de la semana la retoma (ver app/api/semana).
  if (st === "generating" && fila.gen_error === EN_FILA) return "en_fila";
  if (st === "generating") return edad > staleMs ? "error" : "generando";
  return "error";
}

/** Un día ocupa su fecha si está listo o en camino; con error se puede volver a pedir. */
export function ocupaLaFecha(estado: EstadoDia): boolean {
  return estado !== "error";
}
