// EL FEED DE ACTIVIDAD: qué hizo la gente, en orden, cruzando TODAS las fuentes.
//
// Nació de Roberto (2026-09-01): "me gustaría tener un feed de todas las
// acciones que hacen los usuarios… que eventualmente nos ayude a cruzar la
// información". Ataca el tapón documentado del experimento — el problema no es
// que no haya usuarias, es que nadie las está observando.
//
// POR QUÉ NO SALE DE `events`, que es lo que uno esperaría. Medido contra
// producción el 2026-09-01, con 610 eventos:
//   · el 76% es INSTRUMENTACIÓN, no acciones: onboarding_step (144),
//     generation_timing (88), critic_review (86), hint_seen (78) y
//     avatar_judge (65) suman 461. Un feed de eso enseña jueces y timings.
//     (Desde el 2026-09-12 esa instrumentación tampoco se tira: se resume en
//     una línea "abrió la app" por vuelta — ver EVENTOS_PASIVOS.)
//   · y la acción más importante del producto NO ESCRIBE EVENTO: añadir
//     prendas son 1012 filas en `items` y cero en `events`. Los looks son 172
//     outfits contra 88 generation_timing. Los viajes, 9 sin evento.
// O sea: `select * from events` habría enseñado telemetría y escondido lo
// único que la gente hace de verdad. El cruce de fuentes no es lujo, es la
// única forma de que el feed no mienta.
//
// El cruce en sí ya estaba probado: app/admin/usuarios/page.tsx lo hace para
// calcular el "hace 21 horas" de cada fila. Esto es el MISMO cruce ordenado
// por tiempo en vez de agrupado por persona.

/** Una línea del feed. `n > 1` = ráfaga colapsada (ver colapsar). */
export type Momento = {
  /** Clave estable para React y para depurar. */
  key: string;
  userId: string;
  /** ISO del momento MÁS RECIENTE de la ráfaga. */
  at: string;
  tipo: TipoMomento;
  /** Cuántas acciones iguales se colapsaron en esta línea (1 = una sola). */
  n: number;
  /** Id del objeto tocado (outfit, trip…) cuando la línea es de una sola. */
  refId?: string | null;
  /** Detalle libre para la etiqueta (paso del onboarding, segundos del TTV…). */
  data?: Record<string, unknown> | null;
};

export type TipoMomento =
  | "alta"
  | "visita"
  | "prenda_add"
  | "prenda_del"
  | "look"
  | "look_del"
  | "viaje"
  | "viaje_del"
  | "cartera"
  | `ev:${string}`;

// EVENTOS QUE NO SON UNA ACCIÓN, pero SÍ PRUEBAN QUE LA PERSONA ESTABA AHÍ:
// instrumentación del motor y de la IA (timings, jueces, revisiones) y los
// tips, que se escriben cuando alguien CIERRA la burbuja.
//
// Hasta el 2026-09-12 se tiraban y el feed perdía algo que importa. Roberto:
// "abrir la app puede contar como una acción, y es importante ver eso". Tenía
// razón: `ricardomc888` entró el 10 de septiembre, cerró un tip y se fue sin
// hacer nada — volver y no hacer nada es el hallazgo, y el feed lo escondía.
// Ahora no se tiran: se vuelven UNA línea "abrió la app" por sesión.
export const EVENTOS_PASIVOS = new Set([
  "generation_timing",
  "critic_review",
  "avatar_judge",
  "hint_seen",
  "intro_seen",
]);

// ESTOS SÍ SE TIRAN, y no son visita: son un duplicado INCOMPLETO de la tabla
// (la fila ya trae su deleted_at, y el evento sólo lo escribieron algunos).
export const EVENTOS_DUPLICADOS = new Set([
  // Medido:
  // 21 prendas con `deleted_at` contra 10 eventos `item_deleted` — o sea que
  // 11 borrados no escribieron evento. Con los dos dentro, cada borrado que sí
  // lo escribió salía DOS VECES en el feed (son `tipo` distinto, así que el
  // colapso no los junta) y los otros 11 salían una. La regla que queda:
  // el CICLO DE VIDA lo cuenta la tabla (created_at / deleted_at), y `events`
  // sólo cuenta lo que no deja fila.
  "item_deleted",
  "trip_deleted",
]);

/** Los que no salen como acción propia. Unión de los dos de arriba. */
export const EVENTOS_FUERA = new Set([...EVENTOS_PASIVOS, ...EVENTOS_DUPLICADOS]);

/**
 * Cuánto dura "una visita". Una sola vuelta por la app deja varios rastros
 * sueltos (cerrar un tip, los timings de una generación), y pintar cinco
 * líneas de "abrió la app" para una sesión sería igual de inútil que pintar
 * mil "añadió una prenda" para un carrete. Una hora, no diez minutos: la
 * gente deja la pestaña abierta y vuelve a ella.
 */
export const VENTANA_VISITA_MIN = 60;

/** Etiqueta humana de cada línea. `n` la pluraliza cuando hubo ráfaga. */
export function etiqueta(m: Momento): string {
  const n = m.n;
  switch (m.tipo) {
    case "alta":
      return "se dio de alta";
    // Sin plural: `n` aquí son rastros de la MISMA vuelta, no visitas.
    case "visita":
      return "abrió la app";
    case "prenda_add":
      return n === 1 ? "añadió una prenda" : `añadió ${n} prendas`;
    case "prenda_del":
      return n === 1 ? "borró una prenda" : `borró ${n} prendas`;
    case "look":
      return n === 1 ? "generó un look" : `generó ${n} looks`;
    case "look_del":
      return n === 1 ? "borró un look" : `borró ${n} looks`;
    case "viaje":
      return n === 1 ? "creó un viaje" : `creó ${n} viajes`;
    case "viaje_del":
      return n === 1 ? "borró un viaje" : `borró ${n} viajes`;
    case "cartera":
      return n === 1 ? "guardó algo en su cartera" : `guardó ${n} cosas en su cartera`;
  }
  const t = m.tipo.slice(3);
  const base = EVENTO_LABEL[t];
  if (!base) return n === 1 ? t : `${t} ×${n}`;
  return n === 1 ? base : `${base} ×${n}`;
}

// Etiquetas de los eventos que sí son acciones. Un tipo que no esté aquí NO se
// esconde: sale con su nombre crudo (ver etiqueta), que es la señal de que hay
// que bautizarlo.
export const EVENTO_LABEL: Record<string, string> = {
  vote_up: "votó 👍 un look",
  vote_down: "votó 👎 un look",
  worn: "se puso un look",
  another_look: "pidió otro look",
  trip_look_vote: "votó un look de viaje",
  trip_item_swap: "cambió una prenda del viaje",
  trip_deleted: "borró un viaje",
  item_deleted: "borró una prenda",
  avatar_generated: "generó su avatar",
  espejo_subido: "subió un espejo",
  style_vetoes_edit: "editó sus vetos",
  colorimetria_edit: "ajustó su colorimetría",
  perfil_estilo_view: "revisó su estilo",
  onboarding_step: "avanzó en el onboarding",
  first_outfit_ttv: "llegó a su primer look",
  pwa_installed: "instaló la app",
  cuenta_borrado_programado: "pidió borrar su cuenta",
  cuenta_recuperada: "recuperó su cuenta",
  generation_failed: "se le falló una generación",
};

/**
 * COLAPSA LAS RÁFAGAS. Es lo que separa un feed legible de un log inservible.
 *
 * Medido en producción: el 87% de las prendas (879 de 1012) entra en tandas de
 * 6 o más EN EL MISMO MINUTO — importar un carrete son 20-40 filas de un tirón,
 * y 13 tandas de 20+ suman 384 prendas ellas solas. Crudo, el feed serían mil
 * líneas de "añadió una prenda" tapando todo lo demás; colapsado son 126
 * momentos. La misma regla sirve para los pasos del onboarding, que si no se
 * comen 144 líneas.
 *
 * La regla: acciones del MISMO usuario, del MISMO tipo, separadas por menos de
 * `ventanaMin`, son un solo momento. No se colapsa entre usuarios distintos ni
 * entre tipos distintos — eso borraría justo lo que se viene a ver.
 *
 * Los momentos que quedan solos conservan su `refId` para poder enlazar al
 * objeto; una ráfaga no lo lleva porque son varios.
 */
export function colapsar(momentos: Momento[], ventanaMin = 10): Momento[] {
  const orden = [...momentos].sort((a, b) => cmpDesc(a.at, b.at));
  const out: Momento[] = [];
  for (const m of orden) {
    const prev = out[out.length - 1];
    const mismaTanda =
      prev &&
      prev.userId === m.userId &&
      prev.tipo === m.tipo &&
      minutosEntre(m.at, prev.at) <= ventanaMin;
    if (mismaTanda) {
      prev.n += m.n;
      // La ráfaga deja de apuntar a UN objeto: ya son varios.
      prev.refId = null;
      continue;
    }
    out.push({ ...m });
  }
  return out;
}

function cmpDesc(a: string, b: string): number {
  return a < b ? 1 : a > b ? -1 : 0;
}

function minutosEntre(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

/** Filas crudas de cada tabla, tal como salen del select. */
export type FuentesCrudas = {
  profiles: { id: string; created_at: string | null }[];
  items: { id: string; user_id: string | null; created_at: string | null; deleted_at: string | null }[];
  outfits: { id: string; user_id: string | null; created_at: string | null; deleted_at: string | null }[];
  trips: { id: string; user_id: string | null; created_at: string | null; deleted_at: string | null }[];
  wishlist: { user_id: string | null; created_at: string | null }[];
  events: {
    user_id: string | null;
    outfit_id: string | null;
    type: string;
    data: Record<string, unknown> | null;
    created_at: string | null;
  }[];
};

/**
 * Las 6 fuentes → un feed ordenado y colapsado.
 *
 * OJO con `items`: una prenda borrada aporta DOS momentos (cuando entró y
 * cuando se fue), no cero. El feed cuenta lo que pasó, no lo que queda — si
 * filtráramos por `deleted_at is null`, borrar 20 prendas haría desaparecer del
 * historial también el día en que las subió.
 *
 * Los BORRADOS salen siempre de la tabla, nunca del evento: ver EVENTOS_FUERA.
 */
export function construirFeed(f: FuentesCrudas, ventanaMin = 10): Momento[] {
  const m: Momento[] = [];
  const push = (
    userId: string | null | undefined,
    at: string | null | undefined,
    tipo: TipoMomento,
    key: string,
    refId?: string | null,
    data?: Record<string, unknown> | null
  ) => {
    if (!userId || !at) return;
    m.push({ key, userId, at, tipo, n: 1, refId: refId ?? null, data: data ?? null });
  };

  for (const p of f.profiles) push(p.id, p.created_at, "alta", `alta:${p.id}`);
  for (const it of f.items) {
    push(it.user_id, it.created_at, "prenda_add", `i+:${it.id}`, it.id);
    push(it.user_id, it.deleted_at, "prenda_del", `i-:${it.id}`, it.id);
  }
  for (const o of f.outfits) {
    push(o.user_id, o.created_at, "look", `o+:${o.id}`, o.id);
    push(o.user_id, o.deleted_at, "look_del", `o-:${o.id}`, o.id);
  }
  for (const t of f.trips) {
    push(t.user_id, t.created_at, "viaje", `t+:${t.id}`, t.id);
    push(t.user_id, t.deleted_at, "viaje_del", `t-:${t.id}`, t.id);
  }
  for (let i = 0; i < f.wishlist.length; i++) {
    const w = f.wishlist[i];
    push(w.user_id, w.created_at, "cartera", `w:${i}`);
  }
  // Los pasivos no son una decisión, pero prueban presencia: se juntan aparte
  // en "abrió la app" con su propia ventana, y se mezclan al final para que
  // una visita quede en su lugar exacto de la línea de tiempo.
  const visitas: Momento[] = [];
  for (let i = 0; i < f.events.length; i++) {
    const e = f.events[i];
    if (EVENTOS_DUPLICADOS.has(e.type)) continue;
    if (EVENTOS_PASIVOS.has(e.type)) {
      if (e.user_id && e.created_at) {
        visitas.push({
          key: `v:${i}`,
          userId: e.user_id,
          at: e.created_at,
          tipo: "visita",
          n: 1,
          refId: null,
          data: null,
        });
      }
      continue;
    }
    push(e.user_id, e.created_at, `ev:${e.type}`, `e:${i}`, e.outfit_id, e.data);
  }
  return colapsar([...m, ...colapsar(visitas, VENTANA_VISITA_MIN)], ventanaMin);
}

/** Lo mínimo que necesita ultimoUsoPorUsuario de cada tabla. */
type FilaConFecha = {
  user_id?: string | null;
  created_at: string | null;
  deleted_at?: string | null;
};

/**
 * ÚLTIMO USO ≠ ÚLTIMA ACCIÓN. Confundirlos ya costó una lectura equivocada.
 *
 * Roberto, 2026-09-12: la lista decía "hace 2 días" y el detalle "hace 26
 * días" de la misma persona. Las dos eran ciertas y ese era el problema — la
 * etiqueta era la misma. Entró el 10 de septiembre (dejó un `hint_seen`, que
 * sólo se escribe con la app abierta) y su última ACCIÓN fue borrar un viaje
 * el 17 de agosto. Alguien que abre y no hace nada es justo la señal que este
 * experimento vino a medir: esconderla detrás de "hace 2 días" la borra.
 *
 * Esta función contesta "¿cuándo estuvo aquí?": cuenta TODO rastro, incluida
 * la instrumentación que el feed excluye a propósito (ver EVENTOS_FUERA), y
 * también los borrados, que son uso aunque resten cosas. La otra pregunta,
 * "¿cuándo hizo algo?", la contesta el primer momento del feed.
 *
 * Vive aquí, y no en cada pantalla, porque nació duplicada: la lista lo
 * calculaba en su bucle de conteos y el detalle por su cuenta. Por eso
 * pudieron discrepar sin que nada se rompiera.
 */
export function ultimoUsoPorUsuario(f: {
  items: FilaConFecha[];
  outfits: FilaConFecha[];
  trips: FilaConFecha[];
  wishlist: FilaConFecha[];
  events: { user_id: string | null; created_at: string | null }[];
}): Map<string, string> {
  const out = new Map<string, string>();
  const marca = (uid: string | null | undefined, at: string | null | undefined) => {
    if (!uid || !at) return;
    const prev = out.get(uid);
    // Por tiempo real, no por texto: las fechas llegan con formatos distintos
    // según la fuente ("…Z" y "…+00:00") y comparar strings los ordenaría mal.
    if (!prev || new Date(at).getTime() > new Date(prev).getTime()) out.set(uid, at);
  };
  for (const grupo of [f.items, f.outfits, f.trips, f.wishlist]) {
    for (const fila of grupo) {
      marca(fila.user_id, fila.created_at);
      marca(fila.user_id, fila.deleted_at);
    }
  }
  for (const e of f.events) marca(e.user_id, e.created_at);
  return out;
}

/** Agrupa el feed por día local, conservando el orden. */
export function porDia(momentos: Momento[]): { dia: string; momentos: Momento[] }[] {
  const out: { dia: string; momentos: Momento[] }[] = [];
  for (const m of momentos) {
    const dia = m.at.slice(0, 10);
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.momentos.push(m);
    else out.push({ dia, momentos: [m] });
  }
  return out;
}
