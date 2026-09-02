import type { SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// CUÁNTA IA PUEDE GASTAR UNA PERSONA EN UN DÍA.
//
// POR QUÉ EXISTE
// Hasta hoy no había ningún tope en ninguna de las rutas de IA. Con la beta
// cerrada eso daba igual: 27 cuentas conocidas. Al abrir el registro, una sola
// cuenta con un `for` puede gastar la tarjeta de Roberto en una tarde, y no
// hace falta mala fe — basta un bucle mal escrito en el cliente.
//
// LOS NÚMEROS SALEN DE LO MEDIDO, NO DE UNA CORAZONADA (2026-09-02, contra
// producción). El día más pesado de la usuaria más activa fue: 3 generaciones
// de look, 28 fotos leídas, 7 llamadas al juez. Los topes de abajo son entre 4
// y 7 veces eso. Nadie que use la app con ganas los va a ver; quien los vea
// está haciendo otra cosa.
//
// EL TOPE DE FOTOS ESTUVO A PUNTO DE SER UN ERROR. La primera propuesta fue 40
// y contando PRENDAS: cuatro usuarias reales metieron más de 40 prendas en su
// primer día (Tatiana 67, Mariana 61, Val 43), o sea que el tope habría cortado
// el alta del clóset justo en el peor momento. Contando FOTOS —que es lo que
// cuesta— el máximo real es 28, porque una foto trae varias prendas.
//
// LO QUE NO SE HACE: enseñar el contador en la app. "Te quedan 14 looks"
// convierte un límite generoso en uno que se siente escaso e invita a gastarlo.
// El tope sólo aparece cuando se toca.
// ─────────────────────────────────────────────────────────────────────────────

export type Recurso = "looks" | "avatar" | "tryon" | "fotos";

/** Cuántas veces al día. Aprobados por Roberto el 2026-09-02. */
export const CUOTAS: Record<Recurso, number> = {
  looks: 20,
  avatar: 5,
  tryon: 15,
  fotos: 120,
};

/**
 * Qué filas de `ai_calls` cuentan para cada recurso.
 *
 * `looks` cuenta SÓLO el motor y no el juez: una generación es una llamada al
 * motor y una al juez, así que sumar los dos haría que 20 looks se sintieran
 * como 10. El juez igual entra en el tope de gasto.
 *
 * `fotos` cuenta SÓLO `vision-prendas` (la lectura de la foto) y no
 * `vision-personas` (el portero que cuenta cuántas personas salen). Las dos se
 * disparan por foto, pero contar ambas partiría el tope a la mitad sin decirlo:
 * 120 dejaría de querer decir 120 fotos.
 */
const TAREAS: Record<Recurso, string[]> = {
  looks: ["motor"],
  avatar: ["avatar"],
  tryon: ["tryon", "tryon-wishlist"],
  fotos: ["vision-prendas"],
};

/**
 * Lo que ve la persona al topar. NO es un error y no debe leerse como uno.
 *
 * Las tres reglas del mensaje: no culpar, decir cuándo vuelve, y no explicar la
 * mecánica (a nadie le importa que exista una tabla `ai_calls`). "Mañana" es
 * literal: la ventana es de 24 horas móviles, así que en la práctica se
 * recupera de a poco, y decir "mañana" nunca queda corto.
 */
export const MENSAJE_CUOTA: Record<Recurso, string> = {
  looks: "ya te armé 20 looks hoy. mañana seguimos — el stylist también duerme.",
  avatar: "por hoy ya no puedo rehacer tu avatar — mañana lo afinamos.",
  tryon: "ya te probé 15 looks hoy. mañana van más.",
  fotos: "por hoy llegué a mi tope de fotos. mañana seguimos llenando tu clóset.",
};

/**
 * El freno de mano. Es un BACKSTOP, no el límite principal.
 *
 * Va POR ENCIMA de la suma de los topes de arriba a propósito. Con los precios
 * verificados (un look ~$0.049, una imagen $0.134, una foto ~$0.0012), alguien
 * que agote las cuatro cuotas gasta ~$3.80 en el día. Si el tope de dinero
 * fuera menor que eso saltaría ANTES que los topes por recurso, y entonces la
 * persona recibiría el mensaje genérico ("necesita un respiro") en vez del que
 * explica qué se acabó — que es peor información por el mismo precio.
 *
 * Así que $5 sólo salta si algo se salió del guion: un camino de IA que no
 * cuenta cuota, un bucle, un modelo que se encareció. Cuando salte, hay que ir
 * a ver, no subirlo.
 */
export const TOPE_USD_DIA = Number(process.env.TOPE_USD_DIA ?? 5);

/**
 * El freno global, de toda la app. Hoy el gasto real ronda $1.2 al día entre
 * todo el mundo (medido incluyendo por fin las imágenes), así que $25 es ~20×
 * lo normal: no es un presupuesto, es una alarma de incendio.
 */
export const TOPE_USD_DIA_GLOBAL = Number(process.env.TOPE_USD_DIA_GLOBAL ?? 25);

/** El mensaje del freno de dinero — nunca insinúa que la persona hizo algo mal. */
export const MENSAJE_TOPE_USD = "el stylist necesita un respiro. vuelve en un rato.";
/** El del freno global y el del interruptor manual: tampoco es culpa suya. */
export const MENSAJE_PAUSA = "el stylist está de descanso un momento. vuelve en un rato.";

/**
 * EL INTERRUPTOR MANUAL. Con `MOTOR_PAUSADO=1` en Vercel, toda la IA responde
 * "de descanso" sin llamar a nadie.
 *
 * Existe porque hoy no hay ninguna forma de parar el gasto sin desplegar: si un
 * martes a las 3am algo se desboca, la única salida era revertir. Es una
 * variable de entorno y no una fila en la base para que funcione incluso si lo
 * que está mal es la base.
 */
export function motorPausado(): boolean {
  return process.env.MOTOR_PAUSADO === "1";
}

export type Veredicto =
  | { permitido: true }
  | { permitido: false; motivo: "pausa" | "cuota" | "gasto"; mensaje: string };

/** La ventana: 24 horas móviles hacia atrás. */
export function desdeHace24h(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - 24 * 60 * 60 * 1000).toISOString();
}

/**
 * ¿Puede gastar? Una sola consulta, y falla ABIERTO.
 *
 * Fallar abierto es una decisión, no un descuido: si la consulta de cuota
 * truena, la alternativa es dejar sin su look a alguien que no hizo nada malo
 * para ahorrar cinco centavos. El tope existe contra el abuso sostenido, y el
 * abuso sostenido no sobrevive a que la tabla vuelva.
 */
export async function revisarCuota(
  supabase: SupabaseClient,
  userId: string,
  recurso: Recurso,
  ahora: Date = new Date()
): Promise<Veredicto> {
  if (motorPausado()) {
    return { permitido: false, motivo: "pausa", mensaje: MENSAJE_PAUSA };
  }
  const desde = desdeHace24h(ahora);
  try {
    const { data, error } = await supabase
      .from("ai_calls")
      .select("tarea, costo_usd")
      .eq("user_id", userId)
      .gte("created_at", desde);
    if (error || !data) return { permitido: true };

    const usadas = data.filter((r) =>
      TAREAS[recurso].includes(r.tarea as string)
    ).length;
    if (usadas >= CUOTAS[recurso]) {
      return { permitido: false, motivo: "cuota", mensaje: MENSAJE_CUOTA[recurso] };
    }

    const gastado = data.reduce(
      (t, r) => t + Number((r.costo_usd as number | null) ?? 0),
      0
    );
    if (gastado >= TOPE_USD_DIA) {
      return { permitido: false, motivo: "gasto", mensaje: MENSAJE_TOPE_USD };
    }
    return { permitido: true };
  } catch {
    return { permitido: true };
  }
}

/**
 * Sólo el freno de mano y el tope de dinero, sin cuota por recurso.
 *
 * Para las rutas de IA que no encajan en ninguno de los cuatro recursos: el fit
 * check, la lectura de silueta, el estilo de referencia, el viaje y la foto de
 * destino. Ninguna es repetible en volumen ni cuesta lo que un try-on, así que
 * darles cuota propia sería inventar un número sin nada medido detrás; lo que
 * sí necesitan es quedar cubiertas por el interruptor y por el backstop.
 *
 * EL FIT CHECK SE QUEDA FUERA DE LA CUOTA DE FOTOS a propósito: es la señal de
 * oro del experimento (alguien se puso un look de verdad y lo fotografió) y
 * cuesta menos de un centavo. Cortarlo por un tope pensado para el alta masiva
 * del clóset sería apagar justo lo que se quiere medir.
 */
export async function revisarGasto(
  supabase: SupabaseClient,
  userId: string,
  ahora: Date = new Date()
): Promise<Veredicto> {
  if (motorPausado()) {
    return { permitido: false, motivo: "pausa", mensaje: MENSAJE_PAUSA };
  }
  try {
    const { data, error } = await supabase
      .from("ai_calls")
      .select("costo_usd")
      .eq("user_id", userId)
      .gte("created_at", desdeHace24h(ahora));
    if (error || !data) return { permitido: true };
    const gastado = data.reduce(
      (t, r) => t + Number((r.costo_usd as number | null) ?? 0),
      0
    );
    if (gastado >= TOPE_USD_DIA) {
      return { permitido: false, motivo: "gasto", mensaje: MENSAJE_TOPE_USD };
    }
    return { permitido: true };
  } catch {
    return { permitido: true };
  }
}

/**
 * Cuántas quedan hoy. Sólo la usa el flujo de FOTOS, y por una razón concreta:
 * es el único donde la persona manda un lote. Cortar a media importación y
 * tirar en silencio lo que no cupo es la peor versión posible, así que ahí se
 * pregunta ANTES y se le dice cuántas caben.
 */
export async function restanteDe(
  supabase: SupabaseClient,
  userId: string,
  recurso: Recurso,
  ahora: Date = new Date()
): Promise<number> {
  try {
    const { data } = await supabase
      .from("ai_calls")
      .select("tarea")
      .eq("user_id", userId)
      .in("tarea", TAREAS[recurso])
      .gte("created_at", desdeHace24h(ahora));
    return Math.max(0, CUOTAS[recurso] - (data?.length ?? 0));
  } catch {
    // Misma regla que arriba: ante la duda, deja pasar.
    return CUOTAS[recurso];
  }
}

/**
 * El gasto de TODA la app en la ventana. Se consulta con el cliente de servicio
 * (no hay RLS que deje a una persona ver el gasto de las demás), así que sólo
 * lo llaman rutas de servidor.
 */
export async function gastoGlobal(
  supabase: SupabaseClient,
  ahora: Date = new Date()
): Promise<number> {
  try {
    const { data } = await supabase
      .from("ai_calls")
      .select("costo_usd")
      .gte("created_at", desdeHace24h(ahora));
    return (data ?? []).reduce(
      (t, r) => t + Number((r.costo_usd as number | null) ?? 0),
      0
    );
  } catch {
    return 0;
  }
}
