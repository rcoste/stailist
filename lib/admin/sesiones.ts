import { etiqueta, type Momento } from "@/lib/admin/actividad";

// "QUÉ HIZO", RESUMIDO POR SESIÓN Y POR MÓDULO (2026-10-14).
//
// POR QUÉ EXISTE
// La ficha pintaba un renglón por momento. Con alguien que usa la app de
// verdad eso explota: la ficha de un usuario real llegó a 212 renglones y
// ~8,600 px, y el clóset y los looks quedaban hasta el fondo de la página. Lo
// que Roberto quiere leer de un día no es la lista: es cuántas veces entró,
// cuánto se quedó y en qué se le fue el rato. El detalle sigue a un clic.
//
// LAS DEFINICIONES
// - Sesión: momentos de la misma persona sin un hueco de más de
//   CORTE_SESION_MIN entre uno y el siguiente. La misma media hora que usa la
//   medición de tiempo por módulo; la "visita" del feed (una hora) es otra
//   cosa: junta rastros pasivos, no corta sesiones.
// - Duración: del primer al último momento. Un momento colapsado lleva la
//   hora del MÁS RECIENTE de su ráfaga, así que la duración puede quedarse
//   corta por unos minutos. Es una cota baja, no un cronómetro.
// - Lo que hace la app sola (los dibujos automáticos de prendas, ver
//   construirFeed) no es uso de la persona: va aparte y no suma módulos.

export const CORTE_SESION_MIN = 30;

export type Modulo =
  | "onboarding"
  | "closet"
  | "looks"
  | "viaje"
  | "tryon"
  | "avatar"
  | "espejo"
  | "capsula"
  | "wishlist"
  | "perfil"
  | "otros";

/** Orden y nombre en pantalla. */
export const MODULOS: { id: Modulo; nombre: string }[] = [
  { id: "onboarding", nombre: "Onboarding" },
  { id: "closet", nombre: "Clóset" },
  { id: "looks", nombre: "Looks" },
  { id: "viaje", nombre: "Viaje" },
  { id: "tryon", nombre: "Try-on" },
  { id: "avatar", nombre: "Avatar" },
  { id: "espejo", nombre: "Espejo" },
  { id: "capsula", nombre: "Cápsula" },
  { id: "wishlist", nombre: "Wishlist" },
  { id: "perfil", nombre: "Perfil y colores" },
  { id: "otros", nombre: "Otros" },
];

/** Una acción contable dentro de un módulo: "añadió" ×12. */
type Accion = {
  modulo: Modulo;
  clave: string;
  uno: string;
  varios: (n: number) => string;
};

const a = (
  modulo: Modulo,
  clave: string,
  uno: string,
  varios: (n: number) => string,
): Accion => ({
  modulo,
  clave,
  uno,
  varios,
});

/** De cada tipo de momento, a qué módulo y acción suma. null = no suma (presencia o redundante). */
export function accionDe(m: Momento): Accion | "sistema" | null {
  switch (m.tipo) {
    case "visita":
      return null;
    case "alta":
      return a("onboarding", "alta", "se dio de alta", () => "se dio de alta");
    case "prenda_add":
      return a("closet", "add", "añadió 1", (n) => `añadió ${n}`);
    case "prenda_del":
      return a("closet", "del", "borró 1", (n) => `borró ${n}`);
    case "look":
      return a("looks", "gen", "generó 1", (n) => `generó ${n}`);
    case "look_del":
      return a("looks", "del", "borró 1", (n) => `borró ${n}`);
    case "look_viaje":
      return a("viaje", "looks", "1 look", (n) => `${n} looks`);
    case "viaje":
      return a("viaje", "creo", "creó 1", (n) => `creó ${n}`);
    case "viaje_del":
      return a("viaje", "borro", "borró 1", (n) => `borró ${n}`);
    case "cartera":
      return a("wishlist", "guardo", "guardó 1", (n) => `guardó ${n}`);
  }
  const t = m.tipo.slice(3);
  switch (t) {
    case "render_auto":
      return "sistema";
    case "render_generated":
      return a(
        "closet",
        "dibujo",
        "rehízo 1 dibujo",
        (n) => `rehízo ${n} dibujos`,
      );
    case "vote_up":
    case "vote_down":
      return a("looks", "voto", "votó 1", (n) => `votó ${n}`);
    case "outfit_favorited":
      return a("looks", "guardo", "guardó 1", (n) => `guardó ${n}`);
    case "another_look":
      return a(
        "looks",
        "otro",
        "pidió otro 1 vez",
        (n) => `pidió otro ${n} veces`,
      );
    case "worn":
      // Desde el 2026-08-11 sólo lo escribe el espejo, que ya se cuenta solo.
      return m.data?.via === "espejo"
        ? null
        : a("looks", "worn", "se puso 1", (n) => `se puso ${n}`);
    case "trip_look_vote":
      return a("viaje", "votos", "1 voto", (n) => `${n} votos`);
    case "trip_item_swap":
      return a(
        "viaje",
        "cambios",
        "1 cambio de prenda",
        (n) => `${n} cambios de prenda`,
      );
    case "trip_motivo":
      return a("viaje", "motivos", "dio 1 motivo", (n) => `dio ${n} motivos`);
    case "trip_outfits_generated":
      // Los looks que arma ya salen uno por uno como look de viaje.
      return null;
    case "tryon_generated":
      return a(
        "tryon",
        "tryon",
        "se probó 1 look",
        (n) => `se probó ${n} looks`,
      );
    case "avatar_generated":
      return a("avatar", "gen", "lo generó", (n) => `lo generó ${n} veces`);
    case "avatar_fallo":
      return a(
        "avatar",
        "fallo",
        "le falló 1 vez",
        (n) => `le falló ${n} veces`,
      );
    case "espejo_subido":
      return a("espejo", "subio", "subió 1", (n) => `subió ${n}`);
    case "capsule_generated":
      return a("capsula", "armo", "la armó", (n) => `la armó ${n} veces`);
    case "colorimetria_edit":
      return a(
        "perfil",
        "colores",
        "ajustó sus colores",
        (n) => `ajustó sus colores ${n} veces`,
      );
    case "perfil_estilo_view":
      return a(
        "perfil",
        "estilo",
        "revisó su estilo",
        (n) => `revisó su estilo ${n} veces`,
      );
    case "style_vetoes_edit":
      return a(
        "perfil",
        "vetos",
        "editó sus vetos",
        (n) => `editó sus vetos ${n} veces`,
      );
    case "first_outfit_ttv":
      return a(
        "onboarding",
        "look",
        "llegó a su primer look",
        () => "llegó a su primer look",
      );
    case "onboarding_step":
    case "onboarding_started":
      return a(
        "onboarding",
        "pasos",
        "avanzó 1 paso",
        (n) => `avanzó ${n} pasos`,
      );
    case "wow_otro_look":
      return a(
        "onboarding",
        "otro",
        "pidió otro look",
        (n) => `pidió otro look ${n} veces`,
      );
  }
  // Lo que no tiene casilla se nombra tal cual: es la señal de bautizarlo.
  const texto = etiqueta({ ...m, n: 1 });
  return a("otros", t, texto, (n) => `${texto} ×${n}`);
}

/**
 * El orden de las acciones dentro de un módulo: primero lo que crea, luego lo
 * que quita, luego lo demás. Sin esto salía en el orden en que llegaban
 * ("borró 16, añadió 12"), distinto en cada renglón.
 */
const ORDEN_ACCIONES = [
  "look",
  "pasos",
  "otro",
  "alta",
  "add",
  "del",
  "dibujo",
  "gen",
  "voto",
  "guardo",
  "worn",
  "creo",
  "borro",
  "looks",
  "votos",
  "cambios",
  "motivos",
  "tryon",
  "fallo",
  "subio",
  "armo",
  "colores",
  "estilo",
  "vetos",
];
const posicion = (clave: string) => {
  const i = ORDEN_ACCIONES.indexOf(clave);
  return i === -1 ? ORDEN_ACCIONES.length : i;
};

/** Un módulo con lo que pasó en él: "Clóset" · ["añadió 12", "borró 5"]. */
export type ResumenModulo = {
  modulo: Modulo;
  nombre: string;
  partes: string[];
};

export type Resumen = {
  modulos: ResumenModulo[];
  /** Cuántos dibujos hizo la app sola; 0 = nada. */
  sistema: number;
};

export function resumir(momentos: Momento[]): Resumen {
  const cuenta = new Map<Modulo, Map<string, { accion: Accion; n: number }>>();
  let sistema = 0;
  for (const m of momentos) {
    const ac = accionDe(m);
    if (ac === null) continue;
    if (ac === "sistema") {
      sistema += m.n;
      continue;
    }
    const porAccion = cuenta.get(ac.modulo) ?? new Map();
    const prev = porAccion.get(ac.clave);
    porAccion.set(ac.clave, { accion: ac, n: (prev?.n ?? 0) + m.n });
    cuenta.set(ac.modulo, porAccion);
  }
  const modulos: ResumenModulo[] = [];
  for (const { id, nombre } of MODULOS) {
    const porAccion = cuenta.get(id);
    if (!porAccion) continue;
    // Llegar al primer look manda: si pasó, el alta y los pasos sobran.
    const lista = [...porAccion.values()]
      .filter(
        (x) =>
          !(
            id === "onboarding" &&
            ["pasos", "alta"].includes(x.accion.clave) &&
            porAccion.has("look")
          ),
      )
      .sort((x, y) => posicion(x.accion.clave) - posicion(y.accion.clave));
    modulos.push({
      modulo: id,
      nombre,
      partes: lista.map((x) =>
        x.n === 1 ? x.accion.uno : x.accion.varios(x.n),
      ),
    });
  }
  return { modulos, sistema };
}

export type Sesion = {
  /** ISO del primer y último momento. */
  desde: string;
  hasta: string;
  minutos: number;
  resumen: Resumen;
  /** Entró y no hizo nada: sólo rastros de presencia. */
  soloAbrio: boolean;
  /** Todo lo que pasó fue de la app, no de la persona. */
  soloSistema: boolean;
  /** Los momentos, del más reciente al más viejo (el orden del feed). */
  momentos: Momento[];
};

/**
 * Corta los momentos de UNA persona en sesiones. Devuelve de la más reciente a
 * la más vieja, como el feed.
 */
export function sesiones(
  momentos: Momento[],
  corteMin = CORTE_SESION_MIN,
): Sesion[] {
  const asc = [...momentos].sort((x, y) => Date.parse(x.at) - Date.parse(y.at));
  const grupos: Momento[][] = [];
  for (const m of asc) {
    const g = grupos[grupos.length - 1];
    const ultimo = g?.[g.length - 1];
    if (
      ultimo &&
      (Date.parse(m.at) - Date.parse(ultimo.at)) / 60_000 <= corteMin
    )
      g.push(m);
    else grupos.push([m]);
  }
  return grupos
    .map((g) => {
      const desde = g[0].at;
      const hasta = g[g.length - 1].at;
      const resumen = resumir(g);
      const acciones = g.map(accionDe);
      return {
        desde,
        hasta,
        minutos: Math.round((Date.parse(hasta) - Date.parse(desde)) / 60_000),
        resumen,
        soloAbrio: acciones.every((x) => x === null),
        soloSistema: resumen.modulos.length === 0 && resumen.sistema > 0,
        momentos: [...g].reverse(),
      };
    })
    .reverse();
}

/** "6 min", "2 h 18 min", "menos de 1 min". */
export function duracion(min: number): string {
  if (min < 1) return "menos de 1 min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
