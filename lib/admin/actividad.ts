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
  | "prenda_add"
  | "prenda_del"
  | "look"
  | "look_del"
  | "viaje"
  | "viaje_del"
  | "cartera"
  | `ev:${string}`;

// EVENTOS QUE NO ENTRAN AL FEED. Dos familias, y las dos por la misma razón:
// no son algo que una persona haya decidido hacer.
//   · instrumentación del motor y de la IA (timings, jueces, revisiones);
//   · "vio" un elemento de UI, que ocurre sin intención.
// Todo lo demás entra: la lista es de EXCLUSIÓN a propósito, para que un
// evento nuevo aparezca solo en el feed en vez de quedarse invisible hasta que
// alguien se acuerde de darlo de alta en un diccionario.
export const EVENTOS_FUERA = new Set([
  "generation_timing",
  "critic_review",
  "avatar_judge",
  "hint_seen",
  "intro_seen",
  // Y LOS BORRADOS, que son un duplicado INCOMPLETO de la tabla. Medido:
  // 21 prendas con `deleted_at` contra 10 eventos `item_deleted` — o sea que
  // 11 borrados no escribieron evento. Con los dos dentro, cada borrado que sí
  // lo escribió salía DOS VECES en el feed (son `tipo` distinto, así que el
  // colapso no los junta) y los otros 11 salían una. La regla que queda:
  // el CICLO DE VIDA lo cuenta la tabla (created_at / deleted_at), y `events`
  // sólo cuenta lo que no deja fila.
  "item_deleted",
  "trip_deleted",
]);

/** Etiqueta humana de cada línea. `n` la pluraliza cuando hubo ráfaga. */
export function etiqueta(m: Momento): string {
  const n = m.n;
  switch (m.tipo) {
    case "alta":
      return "se dio de alta";
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
  for (let i = 0; i < f.events.length; i++) {
    const e = f.events[i];
    if (EVENTOS_FUERA.has(e.type)) continue;
    push(e.user_id, e.created_at, `ev:${e.type}`, `e:${i}`, e.outfit_id, e.data);
  }
  return colapsar(m, ventanaMin);
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
