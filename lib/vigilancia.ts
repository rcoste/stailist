// ¿HAY QUE DESPERTAR A ALGUIEN?
//
// POR QUÉ EXISTE
// La observabilidad del proyecto es de TIRAR, no de EMPUJAR: `/admin/ia` y
// `/admin/actividad` cuentan cosas muy bien, pero sólo si Roberto entra a
// mirarlas. `lib/senales-vivas.ts` lo dice de sí mismo en su cabecera: "NO es
// monitoreo de verdad (no avisa solo)".
//
// El precio ya se pagó dos veces (los dos bugs silenciosos de agosto: el
// precalentado que se cancelaba solo y el fit check que dejó de escribir
// `worn`), y las dos veces se descubrió por casualidad, semanas después. Con la
// app abierta al público el mismo silencio cuesta dinero: si la llave de Gemini
// se queda sin crédito un sábado, la app responde "el stylist está ocupado" a
// todo el mundo hasta que alguien escriba.
//
// LA REGLA DEL AVISO: sólo se manda si hay algo que hacer. Un correo diario de
// "todo bien" se aprende a ignorar en una semana, y entonces el día que diga
// otra cosa tampoco se lee.

export type Alarma = {
  clave: "fallos" | "gasto" | "persona";
  titulo: string;
  detalle: string;
};

/** Fallos en una hora a partir de los cuales ya no es mala suerte. */
export const FALLOS_PARA_AVISAR = 5;

/**
 * Fallos DE UNA MISMA PERSONA en una hora: alguien atorado, no ruido.
 *
 * EL CASO QUE LO PIDIÓ (2026-09-09). Val —la única persona que usa la app a
 * diario— intentó verse un look puesto CUATRO veces entre 12:19 y 12:50 y las
 * cuatro fallaron: el modelo de imagen de Google estaba caído esa media hora.
 * Se rindió y no volvió a intentarlo.
 *
 * La vigilancia ya corría cada hora y NO avisó: cuatro fallos, uno menos que
 * `FALLOS_PARA_AVISAR`. El umbral absoluto está bien pensado para volumen alto
 * —cinco fallos sueltos entre cientos de llamadas sí son señal— pero ese día
 * hubo OCHO llamadas en total: los cuatro fallos eran el 50%, y todos de la
 * misma persona.
 *
 * Tres es el corte porque dos pueden ser un reintento con mala suerte; a la
 * tercera la persona ya está viendo que "no funciona" y decidiendo irse. Se
 * enteró tres horas después, por casualidad, auditando otra cosa.
 */
export const FALLOS_MISMA_PERSONA = 3;

/**
 * Decide qué hay que avisar. Función pura: recibe los números ya contados para
 * poder probar los bordes sin base de datos.
 *
 * `tasa` no se usa como disparador y `fallos` sí, a propósito: dos fallos de
 * dos llamadas son 100% y no significan nada; cinco fallos en una hora sí,
 * pasen las que pasen. La tasa entra en el texto porque ayuda a leerlo.
 *
 * Y desde 2026-09-09 hay un SEGUNDO disparador que no mira el total sino a la
 * PERSONA: tres fallos de la misma en una hora es alguien atorado ahora mismo,
 * y eso importa aunque el total no llegue a cinco (ver FALLOS_MISMA_PERSONA).
 */
export function decidirAlarmas(m: {
  fallosUltimaHora: number;
  llamadasUltimaHora: number;
  gastoUltimasHoras: number;
  topeGasto: number;
  /** La persona con MÁS fallos en la última hora, si alguna tuvo. */
  peorPersona?: { correo: string; fallos: number; tarea?: string | null } | null;
}): Alarma[] {
  const alarmas: Alarma[] = [];

  // Alguien atorado AHORA: va primero porque es el único aviso que tiene a una
  // persona real esperando del otro lado.
  const p = m.peorPersona;
  if (p && p.fallos >= FALLOS_MISMA_PERSONA) {
    alarmas.push({
      clave: "persona",
      titulo: `${p.correo} lleva ${p.fallos} intentos fallidos en una hora`,
      detalle:
        `${p.tarea ? `Todos en "${p.tarea}". ` : ""}` +
        `No es ruido: la misma persona reintentando es alguien viendo que "no funciona" ` +
        `y decidiendo si vuelve. Mira /admin/ia y, si el fallo es del proveedor, ` +
        `escríbele — desde su lado la app falló sin explicación.`,
    });
  }

  if (m.fallosUltimaHora >= FALLOS_PARA_AVISAR) {
    const tasa = m.llamadasUltimaHora
      ? Math.round((m.fallosUltimaHora / m.llamadasUltimaHora) * 100)
      : 100;
    alarmas.push({
      clave: "fallos",
      titulo: `${m.fallosUltimaHora} llamadas de IA fallaron en la última hora`,
      detalle:
        `Es el ${tasa}% de las ${m.llamadasUltimaHora} de esa hora. ` +
        `Si son todas, suele ser la llave (sin crédito o revocada) o el proveedor caído; ` +
        `si son de una sola tarea, es esa tarea. Se para todo con MOTOR_PAUSADO=1 en Vercel.`,
    });
  }

  // El aviso salta al 80% y no al 100%: llegar al tope significa que la app ya
  // está negándole el servicio a la gente, y para entonces avisar llega tarde.
  const umbral = m.topeGasto * 0.8;
  if (m.gastoUltimasHoras >= umbral) {
    alarmas.push({
      clave: "gasto",
      titulo: `La IA lleva $${m.gastoUltimasHoras.toFixed(2)} en 24 horas`,
      detalle:
        `El freno global está en $${m.topeGasto.toFixed(2)} y ya se va por el ` +
        `${Math.round((m.gastoUltimasHoras / m.topeGasto) * 100)}%. ` +
        `Lo normal ronda $1-2 al día. Antes de subir el tope, mira /admin/ia: ` +
        `si el gasto está en una sola cuenta, es esa cuenta.`,
    });
  }

  return alarmas;
}

/** El correo. Texto plano a propósito: es una alarma, no un boletín. */
export function correoDeAlarmas(alarmas: Alarma[]): { subject: string; text: string } {
  const subject =
    alarmas.length === 1
      ? `stailist — ${alarmas[0].titulo}`
      : `stailist — ${alarmas.length} avisos de la IA`;
  const text = [
    "Esto lo manda la vigilancia de stailist porque hay algo que mirar.",
    "",
    ...alarmas.flatMap((a) => [`• ${a.titulo}`, `  ${a.detalle}`, ""]),
    "Panel: https://stailist.co/admin/ia",
  ].join("\n");
  return { subject, text };
}
