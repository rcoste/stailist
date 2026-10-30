// AVISOS PUSH — "tu look de hoy te espera", al teléfono de quien instaló la app.
//
// POR QUÉ EXISTE (2026-10-30)
// Entre sesión y sesión nadie recibe nada: los correos son opt-in y aceptaron
// 2 de 103; la retención muere al día 3. La app ya arma "tu look de hoy" cada
// mañana; lo que falta es avisar que existe. Es la palanca más barata que no
// se ha probado contra ese día 3, y el techo es chico a propósito: 20 personas
// con la app instalada. Un experimento, no una apuesta.
//
// EL SWITCH ES LITERAL: sin NEXT_PUBLIC_AVISOS_PUSH=1 (y la llave pública VAPID)
// no se ofrece, no se suscribe y el cron no manda nada. Se prende en Vercel con
// un redeploy (Next hornea las NEXT_PUBLIC_* en el bundle).
//
// QUÉ VIVE AQUÍ: lo que se puede probar sin navegador ni base. Las reglas de
// tiempo (a quién le toca hoy) y el texto. Lo que habla con el navegador está
// en lib/push-navegador.ts; con la base, en lib/push-actions.ts; el envío, en
// app/api/cron/avisos/route.ts.

export type VariablesPush = { switch?: string; llavePublica?: string };

/** El default se evalúa al llamar, con acceso literal a process.env.NEXT_PUBLIC_*:
 *  es lo único que Next sustituye en el bundle del navegador. */
export function pushActivo(
  v: VariablesPush = {
    switch: process.env.NEXT_PUBLIC_AVISOS_PUSH,
    llavePublica: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  }
): boolean {
  return v.switch === "1" && typeof v.llavePublica === "string" && v.llavePublica.length > 40;
}

/** A dónde lleva el aviso. El parámetro deja huella (push_abierto) y se quita de la URL al llegar. */
export const PARAMETRO_ABIERTO = "desde";
export const VALOR_ABIERTO = "aviso";
export const URL_AL_ABRIR = `/hoy?${PARAMETRO_ABIERTO}=${VALOR_ABIERTO}`;

/** localStorage: ya se le preguntó en este navegador (se pregunta UNA vez). */
export const CLAVE_PREGUNTADO = "stailist:push-preguntado";

/** Casi todo el público está en México; Colombia va una hora adelante y le
 *  llega a las 8. El cron corre a las 13:00 UTC = 7:00 de CDMX. */
export const ZONA_HORARIA = "America/Mexico_City";

export function fechaLocal(ahora: Date, zona: string = ZONA_HORARIA): string {
  // en-CA escribe la fecha como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

export type EstadoParaAviso = {
  /** last_sent_at de la suscripción. */
  ultimoEnvio: string | null;
  /** Última huella de uso (evento, look o prenda), SIN contar los push_enviado. */
  ultimaActividad: string | null;
  /** Avisos mandados desde esa última actividad. */
  enviosSinActividad: number;
  /** Envíos fallidos seguidos (no 404/410, que matan la suscripción al instante). */
  fallos: number;
  /** Looks que generó HOY (fecha local). */
  looksHoy: number;
};

/** Con tres fallos seguidos se deja de intentar con esa suscripción. */
export const MAX_FALLOS = 3;
/** Siete avisos sin que vuelva = se fue. Insistir a diario ya es spam; el
 *  correo semanal (si lo aceptó) sigue por su carril lento. */
export const MAX_SIN_RESPUESTA = 7;
/** Si usó la app hace menos de esto, ya está aquí: no se le avisa. */
export const HORAS_RECIENTE = 2;

export type Veredicto = { toca: boolean; motivo: string };

/**
 * ¿Le toca un aviso hoy? Una regla por línea, en orden de lo más barato a lo
 * más discutible. `hoy` es la fecha local; se puede fijar en tests.
 */
export function leTocaAviso(e: EstadoParaAviso, ahora: Date, hoy: string = fechaLocal(ahora)): Veredicto {
  if (e.fallos >= MAX_FALLOS) return { toca: false, motivo: "suscripcion_rota" };
  if (e.ultimoEnvio && fechaLocal(new Date(e.ultimoEnvio)) === hoy) return { toca: false, motivo: "ya_hoy" };
  // Ya generó su look de hoy: avisarle que "le espera" sería hablarle de algo
  // que acaba de hacer. (Un look planeado AYER para hoy no cuenta aquí: ése sí
  // se anuncia, con su título — ver textoDelAviso.)
  if (e.looksHoy > 0) return { toca: false, motivo: "ya_tiene_look_hoy" };
  if (e.ultimaActividad) {
    const hace = ahora.getTime() - new Date(e.ultimaActividad).getTime();
    if (hace < HORAS_RECIENTE * 3_600_000) return { toca: false, motivo: "esta_aqui" };
  }
  if (e.enviosSinActividad >= MAX_SIN_RESPUESTA) return { toca: false, motivo: "sin_respuesta" };
  return { toca: true, motivo: "toca" };
}

export type Aviso = { titulo: string; cuerpo: string; url: string; tag: string };

// Tres textos que rotan por día para que el aviso no sea idéntico cada mañana.
// Voz de la app: tuteo, cálida, sin jerga y sin emoji.
const VARIANTES: ReadonlyArray<Pick<Aviso, "titulo" | "cuerpo">> = [
  { titulo: "¿qué te pones hoy?", cuerpo: "Tu look de hoy te espera. Un toque y listo." },
  { titulo: "tu look de hoy", cuerpo: "Ya puedo armártelo con tu ropa. ¿Lo vemos?" },
  { titulo: "antes de abrir el clóset", cuerpo: "Déjame armarte el de hoy. Tarda menos que decidir." },
];

/** Largo máximo del título del look dentro del aviso (iOS corta el cuerpo pronto). */
const MAX_TITULO = 80;

/**
 * El texto del aviso. Si ya tiene un look para hoy (lo planeó con "arma tu
 * semana"), se anuncia con su título: es lo más personal que se puede decir
 * sin gastar una llamada de IA por persona cada mañana.
 */
export function textoDelAviso(o: { tituloHoy: string | null; hoy: string }): Aviso {
  const base = { url: URL_AL_ABRIR, tag: "look-de-hoy" };
  const titulo = (o.tituloHoy ?? "").replace(/\s+/g, " ").trim();
  if (titulo) {
    const corto = titulo.length > MAX_TITULO ? `${titulo.slice(0, MAX_TITULO - 1).trimEnd()}…` : titulo;
    return { ...base, titulo: "tu look de hoy ya está", cuerpo: `${corto}. Ábrelo para verlo completo.` };
  }
  const dia = Number(o.hoy.slice(-2)) || 0;
  return { ...base, ...VARIANTES[dia % VARIANTES.length] };
}
