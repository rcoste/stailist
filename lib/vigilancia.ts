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

import { SITE, boton, kicker } from "@/lib/email-marca";
import { OCRE, ROJO, TINTA, bloqueAviso, envolturaInterna, esc, fila } from "@/lib/admin/correo-interno";

export type Alarma = {
  clave: "fallos" | "gasto" | "persona" | "persona-gasto";
  titulo: string;
  detalle: string;
  /** La ficha de la persona en el admin, cuando la alarma es de una persona. */
  enlace?: { href: string; texto: string };
};

const fichaDe = (userId: string | null | undefined) =>
  userId ? { href: `${SITE}/admin/usuarios/${userId}`, texto: "Ver su ficha" } : undefined;

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
/**
 * A partir de cuánto se avisa del gasto de UNA persona. Nació del 2026-10-04:
 * una cuenta nueva gastó $19 en una tarde y el dato apareció hasta el día
 * siguiente, en la factura.
 */
export const AVISO_USD_PERSONA = 5;

export function decidirAlarmas(m: {
  fallosUltimaHora: number;
  llamadasUltimaHora: number;
  gastoUltimasHoras: number;
  topeGasto: number;
  /** La persona con MÁS fallos en la última hora, si alguna tuvo. */
  peorPersona?: { correo: string; fallos: number; tarea?: string | null; userId?: string | null } | null;
  /**
   * Quienes CRUZARON el umbral de gasto en la última hora: llevan más de
   * AVISO_USD_PERSONA en 24 horas y hace una hora llevaban menos.
   */
  personasCaras?: { correo: string; gasto: number; userId?: string | null }[];
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
      enlace: fichaDe(p.userId),
    });
  }

  // Una sola cuenta gastando mucho. Se avisa UNA vez, en la hora en que cruza:
  // la consulta sólo trae a quien hace una hora estaba por debajo.
  for (const c of m.personasCaras ?? []) {
    if (c.gasto < AVISO_USD_PERSONA) continue;
    alarmas.push({
      clave: "persona-gasto",
      titulo: `${c.correo} lleva $${c.gasto.toFixed(2)} de IA en 24 horas`,
      detalle:
        `Lo normal por persona son centavos. No es necesariamente abuso: suele ser alguien ` +
        `subiendo su clóset entero, que es justo lo que se quiere. Sus topes la frenan sola ` +
        `(lib/cuotas.ts); esto es para que te enteres el mismo día. Mira qué hizo en /admin/ia.`,
      enlace: fichaDe(c.userId),
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
        `Al llegar al tope se pausan las imágenes de todos (los looks siguen). ` +
        `Antes de subirlo, mira /admin/ia: ` +
        `si el gasto está en una sola cuenta, es esa cuenta.`,
    });
  }

  return alarmas;
}

const ETIQUETA: Record<Alarma["clave"], { texto: string; color: string }> = {
  persona: { texto: "Alguien atorado", color: ROJO },
  fallos: { texto: "Fallas de la IA", color: ROJO },
  "persona-gasto": { texto: "Gasto de una cuenta", color: OCRE },
  gasto: { texto: "Gasto total", color: OCRE },
};

/**
 * El correo, en texto y con formato. Hasta el 2026-10-07 el HTML era el texto
 * metido en un <pre>; ahora usa el mismo sobre que el resumen de las 8
 * (lib/admin/correo-interno.ts), con cada aviso en su bloque y su color.
 */
export function correoDeAlarmas(alarmas: Alarma[]): { subject: string; text: string; html: string } {
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
  const cuerpo = [
    fila(
      "26px 6px 0",
      `${kicker("Vigilancia de la IA")}<div style="margin-top:10px;font-size:26px;line-height:1.15;font-weight:700;letter-spacing:-0.03em;color:${TINTA};">${
        alarmas.length === 1 ? "Hay algo que mirar" : `Hay ${alarmas.length} cosas que mirar`
      }</div>`
    ),
    ...alarmas.map((a) =>
      fila(
        "22px 6px 0",
        bloqueAviso({ color: ETIQUETA[a.clave].color, etiqueta: ETIQUETA[a.clave].texto, titulo: a.titulo, detalle: a.detalle, enlace: a.enlace })
      )
    ),
    fila("30px 6px 0", boton({ href: `${SITE}/admin/ia`, texto: "Abrir el panel de IA" })),
  ].join("\n");
  const html = envolturaInterna(
    cuerpo,
    esc("Lo manda la vigilancia de stailist cada hora, sólo cuando hay algo que hacer. Hora de la Ciudad de México.")
  );
  return { subject, text, html };
}
