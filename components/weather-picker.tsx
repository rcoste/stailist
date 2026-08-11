"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { Spinner } from "@/components/spinner";
import { Icon, type IconName } from "@/components/icon";
import {
  WORK_DRESS_CODES,
  ropaDeDressCode,
  type WorkDressCode,
} from "@/lib/dress-code";
import { FORMALIDADES, ropaDeFormalidad } from "@/lib/formalidad";
import { TIPOS_EVENTO, formalidadDeEvento } from "@/lib/eventos";
import { pasosDelWizard } from "@/lib/wizard-pasos";
// Clima desde el CLIENTE (Open-Meteo permite CORS): pre-resolver el pronóstico
// del día elegido y geocodificar "la comida es en Irapuato" sin tocar el server.
import {
  getWeather,
  getWeatherForDates,
  geocodePlace,
  hayLluvia,
  type Weather,
} from "@/lib/weather";

// Compositor de "crear outfit" como WIZARD de 3 pasos (rebrand v3):
// 1) ocasión (grid 2×2 + campo abierto) · 2) día/noche · 3) clima (lista de
// bandas + ubicación). Vive dentro del estado `ask` de hoy-client y, al terminar,
// llama onPick(input) con el MISMO contrato LookInput — sin tocar backend.

export type LookInput = {
  objective: string;
  plan?: string;
  momento: "dia" | "noche";
  seedItemId?: string | null; // ancla opcional: prenda fijada para hoy
  formality?: string | null; // solo en "evento". Los valores viven en Formalidad (lib/formalidad.ts) —
  // NO se re-enumeran aquí: esta lista ya se quedó corta cuando entró "playa".
  /**
   * QUÉ evento es (lib/eventos.ts). Reemplazó a preguntar el nivel de
   * formalidad a secas: una boda y una graduación son las dos "formal" y no se
   * resuelven igual — y sobre todo, la gente sabe decir "una boda" y no sabe
   * traducir "coctel" ni "etiqueta".
   */
  tipoEvento?: string | null;
  /** Va a llevar paraguas. Solo viaja cuando dijo que llueve Y que anda afuera. */
  paraguas?: boolean;
  /**
   * Va a estar BAJO TECHO. Solo viaja cuando el clima trae lluvia — es la
   * respuesta a "¿la lluvia te toca?".
   *
   * Roberto: "puede estar lloviendo y si yo voy a estar siempre entechado, me
   * la pela la lluvia". Con esto el server le quita el agua al clima que ve el
   * motor (climaParaElMotor) y se apagan solas las tres reglas de lluvia:
   * capa impermeable, calzado y paraguas. Lo que se GUARDA sigue siendo el
   * clima real.
   */
  techado?: boolean;
  /**
   * Su código de vestimenta del trabajo, si se le acaba de preguntar. Viaja
   * UNA vez —quien llama lo guarda en el perfil— y de ahí en adelante ya no se
   * pregunta: dónde trabajas no cambia cada mañana.
   */
  workDressCode?: WorkDressCode;
  /**
   * Solo cuando su código de trabajo es "variable": si HOY ve cliente. Es dato
   * del DÍA — elegir "depende del día" es justamente decir eso.
   */
  veCliente?: boolean;
  /**
   * Fecha calendario LOCAL del dispositivo (YYYY-MM-DD). Resuelve "hoy" en la
   * zona horaria de la persona — el server corre en UTC y a las 6pm de CDMX ya
   * cree que es mañana.
   */
  fechaLocal?: string;
  /**
   * Look pedido por adelantado: fecha futura (≤ ~16 días, el horizonte del
   * pronóstico). Ausente = hoy, el flujo de siempre. El look queda colgado a
   * esta fecha y ese día amanece siendo el look del día.
   */
  plannedFor?: string | null;
} & ({ lat: number; lon: number } | { weather: { temp_c: number; condition: string } });

// Prenda del clóset para el picker de ancla (foto resuelta en el server).
export type ClosetPick = {
  id: string;
  nombre: string;
  swatch: string;
  imagen: string | null;
  category: string; // top | vestido | bottom | abrigo | calzado | accesorio | otros
};

// Categorías del picker (mismo orden/labels que el clóset del onboarding).
const CAT_ORDER = ["top", "vestido", "bottom", "abrigo", "calzado", "accesorio", "otros"];
const CAT_LABELS: Record<string, string> = {
  top: "Arriba",
  vestido: "Vestidos",
  bottom: "Abajo",
  abrigo: "Abrigos",
  calzado: "Zapatos",
  accesorio: "Accesorios",
  otros: "Otros",
};
// Quita acentos + minúsculas para buscar sin que estorben las tildes.
const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// El paso 1 habla en PLANES, no en categorías (rediseño 2026-08-10). Antes era
// un 2×2 abstracto ("el día a día / trabajo / un evento / refrescar") que
// obligaba a decidir si tu cena "cuenta como un evento" para llegar, dos
// niveles adentro, al catálogo que sí la entiende. Ahora: 2 planes cotidianos
// como cards + los planes sociales del catálogo (lib/eventos.ts) a la vista
// como chips. "refrescar" salió del wizard (nadie entendía qué prometía —
// tarea #14); si viene guardado del onboarding se trata como "diario", igual
// que "viaje". Sin "viaje": ya hay un Modo viaje propio.
const COTIDIANOS: { key: string; label: string; help: string; icon: IconName }[] = [
  { key: "diario", label: "un día normal", help: "lo de siempre, resuelto", icon: "camisa" },
  { key: "oficina", label: "trabajo", help: "verte pro sin pensarlo", icon: "maletin" },
];
const OCASION_KEYS = new Set([...COTIDIANOS.map((o) => o.key), "evento"]);

// Chips sociales: SEIS, en rejilla pareja de 2 columnas y con su ícono. El
// orden es de frecuencia, no el del catálogo.
//
// YA NO HAY "otro…". Antes ese chip revelaba graduación y funeral; ahora esos
// planes —esporádicos de verdad— entran por el campo abierto de abajo, con las
// palabras de la persona. Roberto: "son eventos muy esporádicos... nos quita
// espacio para una acción que no es tan recurrente y que puede ir en otros".
//
// CONSECUENCIA REAL, no cosmética: escribir "un funeral" es `planLibre`, y el
// texto libre se SALTA el paso del detalle (lib/wizard-pasos.ts) y viaja tal
// cual al motor. O sea que sus dos entradas del catálogo (con su formalidad y
// su regla del negro) ya no se alcanzan desde aquí. Se quedan en lib/eventos.ts
// a propósito: los looks viejos las referencian y `lineaTipoEvento` las lee.
const PLANES_VISIBLES: { key: string; icon: IconName }[] = [
  { key: "cena-amigos", icon: "cubiertos" },
  { key: "cita", icon: "copa" },
  { key: "comida-familiar", icon: "techo" },
  { key: "comida-trabajo", icon: "maletin" },
  { key: "fiesta", icon: "destello" },
  { key: "boda", icon: "anillos" },
];

// Fecha calendario LOCAL del dispositivo. NUNCA toISOString(): esa es UTC y
// después de las 6pm (CDMX) ya es "mañana" — la misma trampa que tenía
// look_date en el server.
export function fmtFechaLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Hasta dónde se puede planear: el horizonte del pronóstico de Open-Meteo.
const DIAS_PLANEABLES = 16;

/** Para capacidades del navegador que no cambian mientras la página vive
 *  (¿hay motor de dictado?): no hay a qué suscribirse. Constante de módulo a
 *  propósito — una función nueva por render re-suscribiría en cada uno. */
const suscripcionInmutable = () => () => {};

// La lista de días de la fila "para hoy ▾". key null = hoy (no viaja al server:
// hoy es el flujo de siempre, intacto).
function proximosDias(): { key: string | null; label: string }[] {
  const hoy = new Date();
  return Array.from({ length: DIAS_PLANEABLES + 1 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
    const label =
      i === 0
        ? "hoy"
        : i === 1
          ? "mañana"
          : `${d.toLocaleDateString("es-MX", { weekday: "short" }).replace(".", "")} ${d.getDate()}`;
    return { key: i === 0 ? null : fmtFechaLocal(d), label };
  });
}

// "el sábado 16" / "mañana" — para la fila cerrada, el copy del paso de clima y
// la etiqueta del look planeado en la vista del look (hoy-client).
export function fechaLegible(key: string): string {
  const [y, m, dd] = key.split("-").map(Number);
  const d = new Date(y, m - 1, dd);
  const hoy = new Date();
  const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  if (fmtFechaLocal(manana) === key) return "mañana";
  return `el ${d.toLocaleDateString("es-MX", { weekday: "long" })} ${d.getDate()}`;
}

// "Un evento" es ambiguo (de un coctel casual a una boda de etiqueta) y el motor
// adivinaba mal. Al elegir evento pedimos el nivel de formalidad para acertar.
// La tabla vive en lib/formalidad.ts — la comparten esta pantalla, el prompt,
// la rúbrica y la pantalla donde se califica el comparador. Vivía escrita en
// las cuatro y la cuarta se quedó atrás cuando el criterio cambió.
const FORMALIDAD = FORMALIDADES;
const ropaDe = ropaDeFormalidad;


// 5 bandas de temperatura (mismas de modo Viaje — set canónico, no inventar).
const BUCKETS = [
  { label: "Helado", ref: "para abrigo grueso", temp_c: 5 },
  { label: "Frío", ref: "suéter o chamarra", temp_c: 12 },
  { label: "Templado", ref: "manga larga ligera", temp_c: 19 },
  { label: "Cálido", ref: "playera, a gusto", temp_c: 25 },
  { label: "Caluroso", ref: "lo más fresco", temp_c: 33 },
];

// Etiquetas legibles del plan, reusadas por el "generando" (chips + frase).
// Conserva las keys viejas ("evento", "refrescar"): looks históricos las traen.
const OCASION_LABELS: Record<string, string> = {
  diario: "el día a día",
  oficina: "trabajo",
  evento: "un evento",
  refrescar: "refrescar",
};
export function ocasionLabel(key: string): string {
  return OCASION_LABELS[key] ?? key;
}
export function bucketLabel(temp_c: number): string {
  let best = BUCKETS[0];
  for (const b of BUCKETS) {
    if (Math.abs(b.temp_c - temp_c) < Math.abs(best.temp_c - temp_c)) best = b;
  }
  return best.label;
}

// OJO con el timeout: cuando el permiso se pide POR PRIMERA VEZ, el prompt del
// teléfono tarda lo que tarde la persona en leerlo — un timeout de 5s pierde
// esa carrera y la app se rendía aunque dijeras que sí (bug que vivió Roberto).
// Por eso el default es generoso; el caso permiso-ya-dado responde en <1s igual.
function getPosition(timeoutMs = 30_000): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    const timer = setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { timeout: timeoutMs - 500, maximumAge: 600000 }
    );
  });
}

export function LookRequest({
  defaultObjective,
  onPick,
  onExit,
  skipObjective,
  closet = [],
  defaultSeedItemId = null,
  gender = null,
  workDressCode = null,
  desdeElQuiz = null,
}: {
  title?: string;
  defaultObjective: string | null;
  onPick: (input: LookInput) => void;
  onExit?: () => void;
  // Ancla pre-seleccionada: la usa la card "aún no estrenas X" del home, que
  // abre el wizard con esa prenda ya puesta como ancla.
  defaultSeedItemId?: string | null;
  // Wow (primer outfit): la ocasión ya se eligió en el paso de onboarding →
  // arranca en "momento" y muestra 2 pasos en vez de 3 (no re-pregunta ocasión).
  skipObjective?: boolean;
  // Clóset para el picker de ancla (paso clima). Vacío = no se muestra el picker.
  closet?: ClosetPick[];
  /** Para las anclas de formalidad: la ropa concreta es distinta por género. */
  gender?: "hombre" | "mujer" | null;
  /** El que ya tiene guardado. null = nunca se le ha preguntado. */
  workDressCode?: string | null;
  /** Lo que dijo en el quiz de vida ("oficina creativa o casual"), para el puente. */
  desdeElQuiz?: string | null;
}) {
  // "viaje" (la opción "Aeropuerto" del onboarding) NO es una ocasión del wizard; se
  // trata como "diario" (look cómodo del día) para NO re-preguntar la ocasión al armar
  // el primer look — si no, el skip fallaba y volvía a pedir la ocasión ya elegida.
  // "refrescar" igual: salió del wizard, pero sigue guardado en perfiles viejos.
  const normObjective =
    defaultObjective === "viaje" || defaultObjective === "refrescar"
      ? "diario"
      : defaultObjective;
  const hasDefaultObj = !!(normObjective && OCASION_KEYS.has(normObjective));
  // "Evento" NUNCA se salta, aunque venga elegido del onboarding: es la única
  // ocasión que exige un dato más (la formalidad) y ese dato vive en el paso
  // que el skip se brincaba. O sea que quien elegía "un evento" en el
  // onboarding recibía su PRIMER look sin que nadie le preguntara si era una
  // boda de etiqueta o una cena — justo el hueco que hace incalificable el
  // resultado. Un tap de más para ellos; el resto no lo nota.
  const skip = !!skipObjective && hasDefaultObj && normObjective !== "evento";
  // ÍNDICE en la lista dinámica de pasos (ver `pasos` abajo): el wizard dejó de
  // ser 3 pantallas fijas. Roberto: "son bastantes acciones las que estás
  // pidiendo en la misma pantalla... deberíamos splitear" — una pregunta por
  // pantalla, y los pasos que no aplican simplemente no existen.
  const [idx, setIdx] = useState(0);
  const [objective, setObjective] = useState<string | null>(
    hasDefaultObj ? normObjective : null
  );
  const [openText, setOpenText] = useState("");
  const [momento, setMomento] = useState<"dia" | "noche">("dia");
  // SIN clima por defecto, y es importante que no lo haya.
  //
  // Venía en "Templado" preseleccionado, con su borde de tinta y su bolita
  // llena. Eso hacía dos daños a la vez: la lista de abajo se leía como "ya
  // está contestado" —así que la píldora de ubicación, que es el camino
  // práctico y el único que lee la lluvia, se volvía invisible— y quien pasaba
  // de largo mandaba 19° al motor sin haberlo elegido. Lo segundo no es
  // cosmético: "rompe el clima" fue la etiqueta de defecto más marcada del
  // veredicto (5 de 6). Un clima que nadie eligió es peor que preguntar.
  const [climaIdx, setClimaIdx] = useState<number | null>(null);
  const [rain, setRain] = useState(false);
  // El paraguas cambia SOLO lo de arriba: tapa el torso, no los pies. Sin él,
  // la capa exterior tiene que repeler agua; con él se elige por estilo. Sin
  // esta pregunta, cada día de lluvia colapsaría a la misma chamarra
  // impermeable toda la temporada. Default en `false` a propósito: no
  // contestar debe caer en el lado seguro.
  const [paraguas, setParaguas] = useState(false);
  // "¿La lluvia te toca?" — solo se pregunta cuando el clima trae lluvia.
  // Default "afuera": es el lado seguro. Quien no conteste recibe el look de
  // lluvia de siempre; solo quien DICE que anda bajo techo pierde el agua.
  const [techado, setTechado] = useState(false);
  const [seedItemId, setSeedItemId] = useState<string | null>(defaultSeedItemId); // ancla opcional
  const [sheetOpen, setSheetOpen] = useState(false); // hoja del picker de prenda
  // La fecha del plan. null = hoy — el default silencioso. Vive en el paso
  // "¿cuándo?" junto con día/noche (son la misma pregunta). Solo fechas
  // futuras viajan al server (plannedFor).
  const [fecha, setFecha] = useState<string | null>(null);
  // La hoja de dictado ("te escucho…").
  const [dictado, setDictado] = useState(false);
  // ¿Este navegador sabe transcribir? Es una capacidad del entorno, no estado:
  // en el server no hay window (false, no se pinta el botón) y en el cliente se
  // lee una vez. Si es false queda el mic del teclado, que dicta igual.
  const micDisponible = useSyncExternalStore(
    suscripcionInmutable,
    () => !!ctorDeDictado(),
    () => false
  );
  const openInputRef = useRef<HTMLInputElement>(null);
  // El TIPO de evento (boda, cena con amigos…). Es lo primero que se pregunta
  // al elegir "evento"; su formalidad sale del catálogo y solo se toca si el
  // caso es raro.
  const [tipoEvento, setTipoEvento] = useState<string | null>(null);
  // El AJUSTE manual de formalidad, cuando el default del tipo no aplica.
  // null = usar el del catálogo, que es lo normal.
  const [formalityManual, setFormalityManual] = useState<string | null>(null);
  // Solo se pregunta si NO lo tiene guardado, y solo al elegir "trabajo".
  const [dressCode, setDressCode] = useState<string | null>(null);
  // "¿hoy ves cliente?" — solo para quien dijo "depende del día". Sin esto el
  // motor se cubre en medio y sale mal por los dos lados: corto el día de
  // cliente, tieso el día que no.
  const [veCliente, setVeCliente] = useState(false);
  // El "¿dónde?" opcional (caso Irapuato: vives en CDMX, la comida del viernes
  // es en otra ciudad — el pronóstico depende del DÓNDE). Default silencioso:
  // donde estás; solo si lo tocas se geocodifica otra ciudad (misma pieza del
  // modo Viaje, sin pedir permiso de ubicación).
  const [ciudadTexto, setCiudadTexto] = useState("");
  const [ciudadGeo, setCiudadGeo] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [ciudadBuscando, setCiudadBuscando] = useState(false);
  const [ciudadFallo, setCiudadFallo] = useState(false);
  // "¿Dónde?" explícito (Roberto): "si es en tu ciudad, comparte tu ubicación;
  // si es en otro lugar, dime la ciudad y saco el clima". Tocar "aquí" pide el
  // permiso EN ese tap (gesto del usuario, no un prompt sorpresa al montar).
  const [donde, setDonde] = useState<"aqui" | "otra">("aqui");
  const [aquiCoords, setAquiCoords] = useState<{ lat: number; lon: number } | null>(null);
  // El permiso tiene TRES finales, no dos, y el tercero era el "raro" que vivió
  // Roberto: si el navegador ya lo tiene BLOQUEADO (un "no permitir" viejo), el
  // prompt no vuelve a salir jamás — falla en silencio. Se distingue y se dice.
  // "pedir" = todavía no hay permiso y NO lo pedimos de sorpresa: se explica
  // qué se va a usar y un botón lo pide. El prompt del navegador sale una sola
  // vez en la vida de la instalación; gastarlo sin contexto es la forma más
  // cara de perderlo (un "no permitir" no se puede volver a preguntar).
  const [aquiEstado, setAquiEstado] = useState<
    "idle" | "pedir" | "leyendo" | "listo" | "bloqueado" | "fallo"
  >("idle");
  // El clima pre-resuelto ("así estará el sábado: 19°, lluvia"). Solo informa
  // el banner; las bandas quedan editables — la corrección manual siempre gana.
  const [climaAuto, setClimaAuto] = useState<Weather | null>(null);
  const [resolviendo, setResolviendo] = useState(false);
  const autoClimaIntentado = useRef(false);
  // Qué banda/lluvia dejó el pre-llenado: si al armar siguen igual, viaja el
  // clima LEÍDO (22° reales), no la banda redondeada; si corrigió, gana lo suyo.
  const autoPrefill = useRef<{ idx: number; rain: boolean } | null>(null);

  // Campo abierto y tarjetas son mutuamente excluyentes (el "o" lo deja claro).
  const hasOpen = openText.trim().length > 0;
  const objectivePart: { objective: string; plan?: string } = hasOpen
    ? { objective: "diario", plan: openText.trim() }
    : { objective: objective ?? "diario" };

  // Trabajo exige su código de vestimenta la PRIMERA vez, por lo mismo que
  // evento exige formalidad: sin ese dato el motor adivina y el resultado no se
  // puede ni calificar. Después ya no se pregunta nunca.
  const pideDressCode = objective === "oficina" && !workDressCode;
  // El código efectivo: el guardado, o el que acaba de elegir en este mismo
  // paso (así la pregunta del día aparece de inmediato, sin esperar a la
  // siguiente sesión).
  const codigoHoy = workDressCode ?? dressCode;
  const pideVeCliente = objective === "oficina" && codigoHoy === "variable";
  // LOS PASOS, dinámicos: plan → detalle (solo si hay algo que acotar) →
  // cuándo (fecha + día/noche + dónde) → clima. La máquina vive en
  // lib/wizard-pasos.ts, como función pura y probada caso por caso: estaba
  // inline aquí y así escondió durante meses el hueco del primer look.
  const pasos = pasosDelWizard({
    saltaElPlan: skip,
    objective,
    tipoEvento,
    planLibre: hasOpen,
    codigoGuardado: workDressCode ?? null,
    codigoEfectivo: codigoHoy,
  });
  const paso = pasos[Math.min(idx, pasos.length - 1)];

  // ¿Se puede avanzar desde el paso actual? Una condición por pantalla.
  const planReady =
    hasOpen || (objective === "evento" ? !!tipoEvento : !!objective);
  const detalleReady = pideDressCode ? !!dressCode : true;
  // La formalidad: la del catálogo según el tipo y el momento, salvo que la
  // haya ajustado a mano. El momento importa — una cena no es una comida.
  const formality =
    formalityManual ?? formalidadDeEvento(tipoEvento, momento) ?? null;
  const esEvento = objectivePart.objective === "evento" && !hasOpen;
  const formalityOut = esEvento ? formality : null;
  const tipoEventoOut = esEvento ? tipoEvento : null;

  function next() {
    setIdx((i) => Math.min(i + 1, pasos.length - 1));
  }
  function back() {
    if (idx === 0) onExit?.();
    else setIdx((i) => i - 1);
  }

  // PRE-RESOLVER el clima al entrar al paso: si hay ciudad geocodificada, o si
  // el permiso de ubicación YA está dado (nunca disparamos el prompt del
  // browser solos — eso es un gesto del usuario), se lee el pronóstico del día
  // elegido y las bandas amanecen contestadas. El paso se vuelve "así estará —
  // corrige si no va" en vez de una pregunta. Sin coords: el flujo manual de
  // siempre, con su píldora.
  // Lee el clima de esas coords para la fecha elegida y deja el paso como
  // CONCLUSIÓN (banner + bandas pre-llenadas, editables). Lo comparten el
  // auto-resuelto al entrar al paso y el botón "compartir mi ubicación".
  async function resolverClima(coords: { lat: number; lon: number }) {
    setResolviendo(true);
    const w = fecha
      ? await getWeatherForDates(coords.lat, coords.lon, fecha, fecha)
      : await getWeather(coords.lat, coords.lon);
    setResolviendo(false);
    if (!w) return;
    setClimaAuto(w);
    let mejor = 0;
    BUCKETS.forEach((b, i) => {
      if (Math.abs(b.temp_c - w.temp_c) < Math.abs(BUCKETS[mejor].temp_c - w.temp_c)) mejor = i;
    });
    // La MISMA pregunta que se hace el motor (lib/weather). Vivía aquí como un
    // literal propio —sin el flag de mayúsculas y con otra lista de palabras—,
    // que es exactamente la divergencia que rompe el techado en silencio: la
    // UI no pregunta por una lluvia que el motor sí ve, o al revés.
    const llueve = hayLluvia(w.condition);
    setClimaIdx((prev) => prev ?? mejor);
    if (llueve) setRain(true);
    autoPrefill.current = { idx: mejor, rain: llueve };
  }

  useEffect(() => {
    if (paso !== "clima" || autoClimaIntentado.current) return;
    autoClimaIntentado.current = true;
    let muerto = false;
    (async () => {
      let coords: { lat: number; lon: number } | null =
        donde === "otra" ? ciudadGeo : aquiCoords;
      if (!coords && donde === "aqui") {
        try {
          const perm = await navigator.permissions?.query({
            name: "geolocation" as PermissionName,
          });
          // Permiso YA dado → responde en <1s; el prompt nunca se dispara solo.
          if (perm?.state === "granted") coords = await getPosition(5000);
        } catch {
          /* sin API de permisos → no adivinamos; queda el flujo manual */
        }
      }
      if (!coords || muerto) return;
      await resolverClima(coords);
    })();
    return () => {
      muerto = true;
    };
    // Reintenta si cambia la ciudad o la fecha y se vuelve a entrar al paso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso]);

  // Cambiar de dónde, ciudad o fecha invalida lo pre-resuelto (se re-lee al
  // volver a entrar al paso de clima).
  useEffect(() => {
    autoClimaIntentado.current = false;
    setClimaAuto(null);
  }, [ciudadGeo, fecha, donde, aquiCoords]);

  async function buscarCiudad() {
    const q = ciudadTexto.trim();
    if (!q) return;
    setCiudadBuscando(true);
    setCiudadFallo(false);
    const geo = await geocodePlace(q);
    setCiudadBuscando(false);
    if (geo) setCiudadGeo(geo);
    else setCiudadFallo(true);
  }

  // Cómo está el permiso de ubicación para este sitio. null = el navegador no
  // tiene la API de permisos (Safari viejo) — ahí no se adivina.
  async function estadoDelPermiso(): Promise<PermissionState | null> {
    try {
      const perm = await navigator.permissions?.query({
        name: "geolocation" as PermissionName,
      });
      return perm?.state ?? null;
    } catch {
      return null;
    }
  }

  async function permisoBloqueado(): Promise<boolean> {
    return (await estadoDelPermiso()) === "denied";
  }

  /** Pide la ubicación de verdad (dispara el prompt del navegador si falta). */
  async function pedirUbicacion() {
    setAquiEstado("leyendo");
    const c = await getPosition();
    if (c) {
      setAquiCoords(c);
      setAquiEstado("listo");
    } else {
      setAquiEstado((await permisoBloqueado()) ? "bloqueado" : "fallo");
    }
  }

  // "En esta ciudad": el tap ya NO dispara el prompt del navegador. Si el
  // permiso ya está dado, lee en silencio (responde en <1s); si está bloqueado,
  // lo dice; y si nunca se ha preguntado, abre el reveal que explica para qué
  // se usa y deja que el botón lo pida. El prompt sin contexto es lo que hace
  // que la gente le dé "no permitir" — y ese "no" no tiene vuelta atrás.
  async function elegirAqui() {
    setDonde("aqui");
    if (aquiCoords) return;
    const perm = await estadoDelPermiso();
    if (perm === "denied") {
      setAquiEstado("bloqueado");
      return;
    }
    if (perm === "granted") {
      await pedirUbicacion();
      return;
    }
    setAquiEstado("pedir");
  }

  // "Compartir mi ubicación" desde el paso del clima (el camino principal
  // cuando el permiso aún no está): resuelve y muestra la conclusión ahí mismo.
  async function compartirUbicacion() {
    if (await permisoBloqueado()) {
      setAquiEstado("bloqueado");
      return;
    }
    setResolviendo(true);
    const c = await getPosition();
    if (!c) {
      setResolviendo(false);
      setAquiEstado((await permisoBloqueado()) ? "bloqueado" : "fallo");
      return;
    }
    setAquiCoords(c);
    setAquiEstado("listo");
    autoClimaIntentado.current = true; // ya estamos resolviendo — que el efecto no doble
    await resolverClima(c);
  }

  function armar() {
    if (climaIdx === null) return;
    const b = BUCKETS[climaIdx];
    // Si el pre-llenado quedó tal cual, viaja el clima LEÍDO (grados y
    // condición reales); si la usuaria corrigió algo, gana su corrección.
    const intacto =
      climaAuto &&
      autoPrefill.current &&
      climaIdx === autoPrefill.current.idx &&
      rain === autoPrefill.current.rain;
    const weather = intacto
      ? { temp_c: climaAuto.temp_c, condition: climaAuto.condition }
      : { temp_c: b.temp_c, condition: rain ? "lluvia" : "despejado" };
    onPick({
      ...objectivePart,
      momento,
      seedItemId,
      formality: formalityOut,
      tipoEvento: tipoEventoOut,
      ...(dressCode ? { workDressCode: dressCode as WorkDressCode } : {}),
      ...(pideVeCliente ? { veCliente } : {}),
      fechaLocal: fmtFechaLocal(new Date()),
      ...(fecha ? { plannedFor: fecha } : {}),
      weather,
      // Con lluvia hay DOS respuestas posibles y son excluyentes: bajo techo el
      // agua no cuenta (y el paraguas no tiene sentido); afuera cuenta y el
      // paraguas decide si la capa de arriba se elige por estilo. Sin lluvia no
      // viaja ninguna de las dos.
      ...(rain ? (techado ? { techado: true } : { paraguas }) : {}),
    });
  }

  // Tarjetas y campo abierto son mutuamente excluyentes: elegir una ocasión
  // limpia el texto; escribir algo des-selecciona las tarjetas.
  function pickObjective(key: string) {
    setObjective((o) => (o === key ? null : key));
    setOpenText("");
    // El tipo de evento y su ajuste solo aplican a "evento": salirse de ahí
    // los limpia, o el siguiente evento heredaría la corrección del anterior.
    if (key !== "evento") {
      setTipoEvento(null);
      setFormalityManual(null);
    }
  }

  // Un chip social es objetivo + tipo en un solo tap (antes había que declarar
  // "un evento" primero — la clasificación que este rediseño mató).
  function pickPlanSocial(key: string) {
    const off = tipoEvento === key;
    setTipoEvento(off ? null : key);
    setObjective(off ? null : "evento");
    // Cambiar de plan reinicia el ajuste de formalidad: el default del tipo
    // nuevo es el bueno, no el que se corrigió para el anterior.
    setFormalityManual(null);
    setOpenText("");
  }
  function changeOpenText(v: string) {
    setOpenText(v);
    if (v.trim()) setObjective(null);
  }

  const meta = `PASO ${Math.min(idx, pasos.length - 1) + 1} DE ${pasos.length}`;
  // Titular con una palabra en serif itálica de acento (Instrument Serif).
  // El del plan es temporalmente NEUTRO a propósito: la fecha vive en su paso
  // "¿cuándo?" — el wizard existe justo para no asumir "hoy".
  const question =
    paso === "plan" ? (
      <>
        ¿qué <em className={EM}>plan</em> tienes?
      </>
    ) : paso === "detalle" ? (
      objective === "evento" ? (
        <>
          ¿qué tan <em className={EM}>arreglado</em> vas?
        </>
      ) : pideDressCode ? (
        <>
          ¿cómo te vistes <em className={EM}>para trabajar</em>?
        </>
      ) : (
        <>
          ¿te toca <em className={EM}>ver cliente</em>?
        </>
      )
    ) : paso === "cuando" ? (
      <>
        ¿<em className={EM}>cuándo</em> es?
      </>
    ) : climaAuto ? (
      <>
        así estará <em className={EM}>el clima</em>
      </>
    ) : fecha ? (
      <>
        ¿cómo estará <em className={EM}>el clima</em>?
      </>
    ) : (
      <>
        ¿cómo está <em className={EM}>el clima</em>?
      </>
    );
  const showBack = idx !== 0 || !!onExit;

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <div className="mx-auto flex h-full max-w-[430px] flex-col">
        {/* Header del paso: cuadro atrás + barra de progreso de 3 segmentos */}
        <div className="px-[18px] pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-3.5">
            {showBack ? (
              <button
                type="button"
                onClick={back}
                aria-label={idx === 0 ? "Salir" : "Atrás"}
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center border border-line text-ink transition-colors hover:border-ink"
              >
                <Icon
                  name={idx === 0 ? "equis" : "chevron"}
                  size={16}
                  rotate={idx === 0 ? 0 : 180}
                />
              </button>
            ) : (
              <span className="h-[34px] w-[34px]" />
            )}
            <div className="flex flex-1 gap-1.5">
              {pasos.map((p, i) => (
                <span
                  key={p}
                  className={`h-[3px] flex-1 rounded-full transition-colors duration-200 ${
                    i <= idx ? "bg-ink" : "bg-line"
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="mt-[26px] text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
            {meta}
          </p>
          <h1 className="mt-2 text-[30px] font-bold leading-[1.04] tracking-[-0.025em] text-ink">
            {question}
          </h1>
        </div>

        {/* Cuerpo scrollable (animado por paso) */}
        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-4 pt-[26px]">
          <div key={paso} style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}>
            {paso === "plan" ? (
              <div className="flex flex-col gap-5">
                <StepPlan
                  objective={objective}
                  openText={openText}
                  tipoEvento={tipoEvento}
                  onPickPlanSocial={pickPlanSocial}
                  onPick={pickObjective}
                  onOpenText={changeOpenText}
                  onDictar={() => setDictado(true)}
                  micDisponible={micDisponible}
                  inputRef={openInputRef}
                />
                {closet.length > 0 ? (
                  <AnchorTrigger
                    selected={closet.find((c) => c.id === seedItemId) ?? null}
                    onOpen={() => setSheetOpen(true)}
                    onClear={() => setSeedItemId(null)}
                  />
                ) : null}
              </div>
            ) : paso === "detalle" ? (
              <StepDetalle
                gender={gender}
                objective={objective}
                tipoEvento={tipoEvento}
                formality={formality}
                onFormalityManual={setFormalityManual}
                pideDressCode={pideDressCode}
                dressCode={dressCode}
                onDressCode={setDressCode}
                desdeElQuiz={desdeElQuiz}
                pideVeCliente={pideVeCliente}
                veCliente={veCliente}
                onVeCliente={setVeCliente}
              />
            ) : paso === "cuando" ? (
              <StepCuando
                fecha={fecha}
                onFecha={setFecha}
                sinFecha={skip}
                momento={momento}
                onMomento={setMomento}
                donde={donde}
                onAqui={elegirAqui}
                onOtra={() => setDonde("otra")}
                onPedirUbicacion={pedirUbicacion}
                aquiEstado={aquiCoords ? "listo" : aquiEstado}
                ciudadTexto={ciudadTexto}
                onCiudadTexto={(v) => {
                  setCiudadTexto(v);
                  setCiudadFallo(false);
                }}
                ciudadGeo={ciudadGeo}
                onQuitarCiudad={() => {
                  setCiudadGeo(null);
                  setCiudadTexto("");
                }}
                ciudadBuscando={ciudadBuscando}
                ciudadFallo={ciudadFallo}
                onBuscarCiudad={buscarCiudad}
              />
            ) : (
              <StepClima
                idx={climaIdx}
                rain={rain}
                onIdx={setClimaIdx}
                onRain={setRain}
                paraguas={paraguas}
                onParaguas={setParaguas}
                techado={techado}
                onTechado={setTechado}
                onCompartir={compartirUbicacion}
                puedeCompartir={donde === "aqui"}
                aquiEstado={aquiEstado}
                fechaLabel={fecha ? fechaLegible(fecha) : null}
                climaAuto={climaAuto}
                resolviendo={resolviendo}
                ciudadLabel={ciudadGeo?.label ?? null}
              />
            )}
          </div>
        </div>

        {/* Footer fijo: un solo CTA full-width (el atrás vive en el header) */}
        <div className="flex flex-none border-t border-line bg-surface px-[18px] pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={paso === "clima" ? armar : next}
            disabled={
              (paso === "plan" && !planReady) ||
              (paso === "detalle" && !detalleReady) ||
              (paso === "clima" && (resolviendo || climaIdx === null))
            }
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50"
          >
            {paso === "clima" ? (
              <>
                <Icon name="destello" size={18} /> armar mi look
              </>
            ) : (
              <>
                siguiente <Icon name="flecha" size={18} />
              </>
            )}
          </button>
        </div>
      </div>

      {dictado ? (
        <DictadoSheet
          inicial={openText}
          onUsar={(t) => {
            changeOpenText(t.slice(0, 200));
            setDictado(false);
          }}
          onClose={() => setDictado(false)}
          onEscribir={() => {
            setDictado(false);
            // Un tick para que la hoja se desmonte antes de pedir el foco: en
            // iOS el teclado no sube si el input aún está tapado por el diálogo.
            setTimeout(() => openInputRef.current?.focus(), 0);
          }}
        />
      ) : null}

      {sheetOpen ? (
        <AnchorSheet
          closet={closet}
          selected={seedItemId}
          onSelect={(id) => {
            setSeedItemId(id);
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}

// Acento serif itálico para los titulares del wizard (Instrument Serif).
const EM = "font-display font-normal italic tracking-normal";
// Selección v3 monocroma: borde tinta (inset, sin reflow) — el ícono se rellena
// de tinta. Sin fondo de color (el v2 usaba tinte rosado/soft).
const ON = "border-ink shadow-[inset_0_0_0_1px_var(--c-ink)]";
const ICON_ON = "bg-accent border-accent text-on-accent";

// El paso del PLAN, y solo el plan: cards + chips + campo abierto. Lo que se
// acota (formalidad, calibración de trabajo) vive en su propio paso "detalle" —
// apilado aquí era el long scroll que Roberto marcó: "son bastantes acciones
// las que estás pidiendo en la misma pantalla".
function StepPlan({
  objective,
  openText,
  tipoEvento,
  onPickPlanSocial,
  onPick,
  onOpenText,
  onDictar,
  micDisponible,
  inputRef,
}: {
  objective: string | null;
  openText: string;
  tipoEvento: string | null;
  /** Abre la hoja de dictado. Solo se pinta el botón si el mic existe aquí. */
  onDictar: () => void;
  micDisponible: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onPickPlanSocial: (k: string) => void;
  onPick: (key: string) => void;
  onOpenText: (v: string) => void;
}) {
  // Los seis de PLANES_VISIBLES, en su orden de frecuencia (no el del catálogo).
  const visibles = PLANES_VISIBLES.map((p) => {
    const t = TIPOS_EVENTO.find((e) => e.key === p.key);
    return t ? { ...t, icon: p.icon } : null;
  }).filter((t): t is (typeof TIPOS_EVENTO)[number] & { icon: IconName } => !!t);

  // Chip social: ícono monolínea + etiqueta, en rejilla pareja de 2 columnas.
  // Seleccionado va con BORDE de tinta y el ícono entintado, no relleno: seis
  // chips negros de golpe pesan más que toda la pantalla junta.
  const chip = (t: (typeof visibles)[number]) => {
    const on = tipoEvento === t.key;
    return (
      <button
        key={t.key}
        type="button"
        onClick={() => onPickPlanSocial(t.key)}
        aria-pressed={on}
        className={`flex min-h-[44px] items-center gap-2 rounded-sm border bg-surface px-3 text-left text-[14px] font-semibold text-ink transition-colors ${
          on ? ON : "border-line hover:border-ink"
        }`}
      >
        <Icon
          name={t.icon}
          size={16}
          className={`shrink-0 ${on ? "text-ink" : "text-muted"}`}
        />
        <span className="min-w-0 flex-1 leading-tight">{t.label}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Los 2 planes cotidianos, como cards (estos SÍ llevan ícono siempre). */}
      <div className="grid grid-cols-2 gap-2.5">
        {COTIDIANOS.map((o) => {
          const on = objective === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onPick(o.key)}
              aria-pressed={on}
              className={`flex min-h-[120px] flex-col gap-2.5 border bg-surface p-4 text-left transition-colors ${
                on ? ON : "border-line hover:border-ink"
              }`}
            >
              <span
                className={`flex h-[34px] w-[34px] items-center justify-center border transition-colors ${
                  on ? ICON_ON : "border-line bg-bg text-ink"
                }`}
              >
                <Icon name={o.icon} size={18} />
              </span>
              <b className="mt-auto text-[16px] font-semibold leading-tight text-ink">
                {o.label}
              </b>
              <span className="text-[15px] leading-tight text-muted">
                {o.help}
              </span>
            </button>
          );
        })}
      </div>

      {/* Los planes sociales, A LA VISTA. Vienen del catálogo de eventos: cada
          uno trae su formalidad default ("la gente sabe decir 'una boda' y no
          sabe traducir 'coctel'"), así que elegir el chip ES contestar todo —
          el ajuste queda para el caso raro. Antes vivían dos niveles adentro,
          detrás de declarar "un evento". */}
      <div className="flex flex-col gap-2.5">
        <div className="my-0.5 flex items-center gap-2.5">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            o un plan social
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <div className="grid grid-cols-2 gap-2">{visibles.map(chip)}</div>
      </div>

      {/* Campo abierto (alternativa) y ÚNICA vía de los planes esporádicos
          (graduación, funeral) desde que se fueron los chips. Lo escrito o
          dictado viaja tal cual al motor como `plan`.

          EL MIC ES PROPIO desde hoy. Este archivo decía "sin botón de mic
          propio (un mic que no graba es una mentira visual)" y esa premisa era
          correcta con la infra de entonces; ya no: el navegador transcribe con
          Web Speech API y el botón sí graba. Roberto revirtió el veto en el
          handoff. Lo que NO cambió es la regla de fondo: si la API no existe
          aquí (pasa en PWA instalada de iOS), el botón no se pinta y queda el
          mic del teclado, que sigue dictando gratis. Un mic muerto sería otra
          vez la mentira visual. */}
      <div className="flex flex-col">
        <div className="my-0.5 mb-2 flex items-center gap-2.5">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            o cuéntamelo con tus palabras
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <div
          className={`flex min-h-[54px] items-center gap-2.5 border bg-surface py-1.5 pl-3.5 pr-2 transition-colors focus-within:border-ink ${
            openText ? "border-ink" : "border-line"
          }`}
        >
          <label className="flex min-w-0 flex-1 items-center gap-2.5">
            <Icon
              name="lapiz"
              size={18}
              className={`shrink-0 ${openText ? "text-ink" : "text-muted"}`}
            />
            <input
              ref={inputRef}
              value={openText}
              onChange={(e) => onOpenText(e.target.value)}
              maxLength={200}
              placeholder={
                micDisponible
                  ? `escríbelo o díctalo — "concierto…"`
                  : `escríbelo o díctalo — "concierto en la noche, algo cool"`
              }
              className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink caret-accent outline-none placeholder:text-muted"
            />
          </label>
          {micDisponible ? (
            <button
              type="button"
              onClick={onDictar}
              aria-label="Dictar tu plan"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-accent text-on-accent transition-colors hover:bg-accent-deep"
            >
              <Icon name="microfono" size={18} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── DICTADO (Web Speech API) ─────────────────────────
//
// Tipos mínimos escritos a mano: `SpeechRecognition` no está en lib.dom y en
// Safari vive con prefijo (`webkitSpeechRecognition`). Solo lo que se usa.
type ResultadoDictado = { isFinal: boolean; 0: { transcript: string } };
type EventoDictado = { results: ArrayLike<ResultadoDictado> };
type ErrorDictado = { error: string };
type Reconocedor = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((e: EventoDictado) => void) | null;
  onerror: ((e: ErrorDictado) => void) | null;
  onend: (() => void) | null;
};

/**
 * El constructor del reconocedor, o null si este navegador no lo tiene.
 *
 * Devolver null NO es un caso raro: es iOS en PWA instalada —justo cómo usan la
 * app Tatiana y Toño— donde la API existe a medias o no existe. Por eso la
 * disponibilidad se consulta y el botón se pinta o no; nunca se asume.
 */
function ctorDeDictado(): (new () => Reconocedor) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Reconocedor;
    webkitSpeechRecognition?: new () => Reconocedor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// La hoja "te escucho…": pulso mientras oye, transcripción en vivo en serif
// itálica, y el texto se usa SOLO si la persona lo confirma. Nada se manda
// sin que lo vea escrito — es la diferencia entre dictar y hablarle al vacío.
function DictadoSheet({
  inicial,
  onUsar,
  onClose,
  onEscribir,
}: {
  /** Lo que ya había en el campo: el dictado se SUMA, no lo borra. */
  inicial: string;
  onUsar: (texto: string) => void;
  onClose: () => void;
  /** "Mejor lo escribo": cierra y manda el foco al campo. */
  onEscribir: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [parcial, setParcial] = useState("");
  const [escuchando, setEscuchando] = useState(false);
  // "permiso" = el navegador tiene el mic bloqueado (no se puede re-preguntar);
  // "falla" = cualquier otra (sin API, red, motor de voz caído). Se inicializa
  // sin API ya en falla — no en un efecto: el estado inicial es estado inicial.
  const [error, setError] = useState<null | "permiso" | "falla">(() =>
    ctorDeDictado() ? null : "falla"
  );
  // Sube con "toca el micrófono y va de nuevo": re-corre el efecto y abre una
  // sesión NUEVA de reconocimiento (reusar la anterior lanza en Safari).
  const [turno, setTurno] = useState(0);
  // Lo dictado en los turnos ANTERIORES. Existe porque cada sesión de
  // reconocimiento empieza en blanco: `onresult` reconstruye la frase de SU
  // sesión (por eso asigna en vez de acumular — el navegador reenvía todos sus
  // resultados), así que sin este acumulador el segundo turno pisaba al
  // primero y "seguir dictando" borraba lo que ya habías dicho.
  const [previo, setPrevio] = useState("");
  // Sin useCallback a propósito: necesita leer `texto` y `parcial` del render
  // actual para archivarlos, y memoizarlo con [] los congelaría vacíos.
  function otraVez() {
    setPrevio((p) => [p, texto, parcial].filter(Boolean).join(" ").trim());
    setTexto("");
    setParcial("");
    setError(null);
    setTurno((t) => t + 1);
  }

  // El reconocedor es un SISTEMA EXTERNO: el efecto solo lo conecta y lo
  // desconecta, y todo cambio de estado entra por sus callbacks (onstart,
  // onresult, onerror, onend). Nada de setState en el cuerpo del efecto.
  useEffect(() => {
    const Ctor = ctorDeDictado();
    if (!Ctor) return;
    let rec: Reconocedor;
    try {
      rec = new Ctor();
    } catch {
      return;
    }
    rec.lang = "es-MX";
    rec.interimResults = true;
    // `continuous` no es confiable en Safari (termina solo igual). Se deja en
    // false y el fin de turno se maneja explícito, con el mic tocable otra vez.
    rec.continuous = false;
    rec.onstart = () => setEscuchando(true);
    rec.onresult = (e) => {
      // Se RECONSTRUYE la frase completa en cada evento, nunca se acumula: el
      // navegador reenvía todos los resultados de la sesión y sumarlos duplica
      // cada palabra.
      let fin = "";
      let inter = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript;
        else inter += r[0].transcript;
      }
      setTexto(fin.trim());
      setParcial(inter.trim());
    };
    rec.onerror = (e) => {
      setEscuchando(false);
      if (e.error === "aborted") return; // lo cancelamos nosotros
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("permiso");
      } else if (e.error !== "no-speech") {
        // "no-speech" NO es un error que mostrar: es haberse quedado callado.
        setError("falla");
      }
    };
    rec.onend = () => setEscuchando(false);
    try {
      rec.start();
    } catch {
      /* onerror lo reporta; si ni eso, queda el mic tocable de nuevo */
    }
    return () => {
      rec.onstart = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        /* ya estaba muerto */
      }
    };
  }, [turno]);

  const dicho = [previo, texto, parcial].filter(Boolean).join(" ").trim();
  const usar = () => onUsar([inicial.trim(), dicho].filter(Boolean).join(" "));

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end bg-[rgb(10_10_10/0.34)] lg:items-center lg:justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Dictar tu plan"
    >
      <div
        // 16px como la hoja del ancla de este mismo archivo (y como el resto de
        // los bottom-sheets): el radio de 3-6px es de chips y cards, no de
        // hojas. Con 4px esta se veía de otra app.
        className="flex flex-col items-center rounded-t-[16px] border-t border-line bg-surface px-6 pb-7 pt-8 text-center lg:w-full lg:max-w-[430px] lg:rounded-[16px]"
        style={{ animation: "var(--dur-medium) var(--ease-enter) sheet-up" }}
        onClick={(e) => e.stopPropagation()}
      >
        {error ? (
          <>
            <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-bg text-ink">
              <Icon name="microfono" size={28} />
            </span>
            <p className="mt-4 text-[20px] font-bold tracking-[-0.02em] text-ink">
              no puedo escucharte
            </p>
            <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-muted">
              {error === "permiso"
                ? "tu navegador tiene el micrófono bloqueado para stailist — actívalo en sus ajustes, o mejor escríbelo"
                : "el dictado no está funcionando en este navegador — mejor escríbelo, es un segundo"}
            </p>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={escuchando ? undefined : otraVez}
              aria-label={escuchando ? "Escuchando" : "Seguir dictando"}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-accent text-on-accent"
              style={
                escuchando
                  ? { animation: "mic-pulse 1.6s var(--ease-exit) infinite" }
                  : undefined
              }
            >
              <Icon name="microfono" size={28} />
            </button>
            <p className="mt-4 font-display text-[24px] italic text-ink">
              {escuchando ? "te escucho…" : "listo, ¿así queda?"}
            </p>
            <p className="mt-2 min-h-[50px] max-w-[300px] font-display text-[18px] italic leading-snug text-muted">
              {dicho ? (
                <>
                  {/* Lo ya reconocido (turnos anteriores incluidos) en tinta;
                      lo que todavía se está oyendo, en gris. Sin `previo` aquí
                      la hoja enseñaba solo el último turno y parecía que lo
                      anterior se había perdido. */}
                  <span className="text-ink">
                    {[previo, texto].filter(Boolean).join(" ")}
                  </span>
                  {parcial ? ` ${parcial}` : null}
                </>
              ) : escuchando ? (
                "cuéntame tu plan…"
              ) : (
                "no alcancé a oír nada — toca el micrófono y va de nuevo"
              )}
            </p>
            {/* QUIÉN ESCUCHA, dicho en voz alta. El dictado no corre en el
                teléfono: el navegador manda el audio a su propio servicio
                (Google en Chrome, Apple en Safari) y nos devuelve el texto.
                Nosotros nunca vemos el audio, pero eso no es obvio y lo
                dictado puede llevar nombres y direcciones de terceros. El
                permiso del sistema no lo explica; aquí sí. */}
            <p className="mt-3 max-w-[300px] text-[11.5px] leading-snug text-faint">
              lo transcribe tu navegador en su nube — nosotros solo recibimos el
              texto, nunca el audio
            </p>
          </>
        )}

        <div className="mt-6 flex w-full gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[50px] flex-1 rounded-sm border border-line bg-surface text-[15px] font-semibold text-ink transition-colors hover:border-ink"
          >
            {error ? "cerrar" : "cancelar"}
          </button>
          <button
            type="button"
            onClick={error ? onEscribir : usar}
            disabled={!error && !dicho}
            className="min-h-[50px] flex-[1.4] rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-40"
          >
            {error ? "mejor lo escribo" : "listo, úsalo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// EL DETALLE del plan — su propio paso, no un long scroll (pedido de Roberto).
// Qué muestra depende de qué se eligió: la formalidad del evento (con el
// default del catálogo pre-seleccionado), o la calibración de trabajo (una
// vez, se edita después en /perfil/trabajo), o el "¿ves cliente?" del día.
function StepDetalle({
  gender,
  objective,
  tipoEvento,
  formality,
  onFormalityManual,
  pideDressCode,
  dressCode,
  onDressCode,
  desdeElQuiz,
  pideVeCliente,
  veCliente,
  onVeCliente,
}: {
  gender: "hombre" | "mujer" | null;
  objective: string | null;
  tipoEvento: string | null;
  formality: string | null;
  onFormalityManual: (f: string | null) => void;
  pideDressCode: boolean;
  dressCode: string | null;
  onDressCode: (d: string) => void;
  desdeElQuiz: string | null;
  pideVeCliente: boolean;
  veCliente: boolean;
  onVeCliente: (v: boolean) => void;
}) {
  if (objective === "evento") {
    const plan = TIPOS_EVENTO.find((t) => t.key === tipoEvento);
    // Solo las formalidades que APLICAN a este plan (esmoquin para una cena
    // con amigos delataba la máquina) y el copy personalizado del catálogo —
    // la queja exacta: "se siente copy-paste".
    const opciones = plan
      ? FORMALIDAD.filter((f) => plan.formalidadesQueAplican.includes(f.key))
      : FORMALIDAD;
    return (
      <div className="flex flex-col gap-2.5">
        <span className="-mt-2 text-[13px] text-muted">
          {plan?.preguntaDetalle ?? "cámbialo si tu caso es distinto"}
        </span>
        <div className="flex flex-col gap-2">
          {opciones.map((f) => {
            const on = formality === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onFormalityManual(f.key)}
                aria-pressed={on}
                className={`flex flex-col items-start rounded-sm border px-3.5 py-2.5 text-left transition-colors ${
                  on
                    ? "border-accent bg-accent text-on-accent"
                    : "border-line bg-surface text-ink hover:border-ink"
                }`}
              >
                <span className="text-[14px] font-semibold">{ropaDe(f, gender)}</span>
                <span className={`text-[12px] ${on ? "opacity-80" : "text-muted"}`}>
                  {f.jerga}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Trabajo: la calibración one-time (después vive editable en /perfil/trabajo)
  // y, para quien dijo "depende del día", la pregunta del día.
  return (
    <div className="flex flex-col gap-5">
      {pideDressCode ? (
        <div className="flex flex-col gap-2.5">
          <span className="-mt-2 text-[13px] text-muted">
            {/* El puente con lo que YA contestó en el quiz de estilo de vida.
                Sin él la pregunta se siente repetida y con razón: allá dijo
                "oficina creativa o casual" y aquí se le vuelve a preguntar por
                el trabajo. La diferencia es real —aquella describe la FORMA de
                su semana y esta el REGISTRO de su ropa— pero si no se dice,
                nadie la ve. */}
            {desdeElQuiz
              ? `dijiste que tu día es ${desdeElQuiz} — esto es qué significa en ropa`
              : "te lo pregunto una vez y lo recuerdo (lo cambias en tu perfil)"}
          </span>
          <div className="flex flex-col gap-2">
            {WORK_DRESS_CODES.map((d) => {
              const on = dressCode === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => onDressCode(d.key)}
                  aria-pressed={on}
                  className={`flex flex-col items-start rounded-sm border px-3.5 py-2.5 text-left transition-colors ${
                    on
                      ? "border-accent bg-accent text-on-accent"
                      : "border-line bg-surface text-ink hover:border-ink"
                  }`}
                >
                  <span className="text-[14px] font-semibold">
                    {ropaDeDressCode(d, gender)}
                  </span>
                  <span className={`text-[12px] ${on ? "opacity-80" : "text-muted"}`}>
                    {d.ejemplos}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* "¿Te toca ver cliente?" — SOLO para quien dijo "depende del día".
          Copy temporalmente neutro: el plan puede ser para otro día (la fecha
          se pregunta en el paso siguiente). Default "no": el día más común. */}
      {pideVeCliente ? (
        <div
          className="flex items-center gap-3 rounded-sm border border-line bg-surface p-3.5"
          style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
        >
          <span className="flex min-w-0 flex-col">
            <span className="text-[14px] font-semibold text-ink">
              ¿te toca ver cliente?
            </span>
            <span className="text-[12px] text-muted">
              me dijiste que depende del día
            </span>
          </span>
          <div className="ml-auto inline-flex shrink-0 overflow-hidden rounded-sm border border-line">
            <button
              type="button"
              onClick={() => onVeCliente(false)}
              aria-pressed={!veCliente}
              className={`min-h-[44px] px-5 text-[14px] font-semibold transition-colors ${
                !veCliente ? "bg-accent text-on-accent" : "bg-surface text-ink"
              }`}
            >
              no
            </button>
            <button
              type="button"
              onClick={() => onVeCliente(true)}
              aria-pressed={veCliente}
              className={`min-h-[44px] border-l border-line px-5 text-[14px] font-semibold transition-colors ${
                veCliente ? "bg-accent text-on-accent" : "bg-surface text-ink"
              }`}
            >
              sí
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// EL CUÁNDO: fecha y día/noche son la MISMA pregunta ("el sábado en la noche"
// es una respuesta, no dos pantallas) + el dónde EXPLÍCITO (Roberto: "si es en
// tu ciudad, comparte tu ubicación; si es en otro lugar, dime la ciudad").
function StepCuando({
  fecha,
  onFecha,
  sinFecha,
  momento,
  onMomento,
  donde,
  onAqui,
  onOtra,
  onPedirUbicacion,
  aquiEstado,
  ciudadTexto,
  onCiudadTexto,
  ciudadGeo,
  onQuitarCiudad,
  ciudadBuscando,
  ciudadFallo,
  onBuscarCiudad,
}: {
  fecha: string | null;
  onFecha: (f: string | null) => void;
  /** Wow (primer look del onboarding): es de hoy por definición — sin fecha. */
  sinFecha: boolean;
  momento: "dia" | "noche";
  onMomento: (m: "dia" | "noche") => void;
  donde: "aqui" | "otra";
  onAqui: () => void;
  onOtra: () => void;
  /** El botón del reveal: aquí SÍ sale el prompt del navegador. */
  onPedirUbicacion: () => void;
  /** El resultado del tap de "aquí": el permiso se pide AHÍ y se dice cómo
   *  quedó — leyendo / listo / bloqueado por el navegador / falló. */
  aquiEstado: "idle" | "pedir" | "leyendo" | "listo" | "bloqueado" | "fallo";
  ciudadTexto: string;
  onCiudadTexto: (v: string) => void;
  ciudadGeo: { lat: number; lon: number; label: string } | null;
  onQuitarCiudad: () => void;
  ciudadBuscando: boolean;
  ciudadFallo: boolean;
  onBuscarCiudad: () => void;
}) {
  // "Otro día" despliega la rejilla completa (wrap, sin scroll horizontal —
  // pedido de Roberto: hoy/mañana/otro día, y solo si eliges "otro" ves todo).
  const [otroDiaOpen, setOtroDiaOpen] = useState(false);
  const dias = proximosDias();
  const keyManana = dias[1]?.key ?? null;
  const esOtroDia = fecha !== null && fecha !== keyManana;
  const CHIP = (on: boolean) =>
    `min-h-[44px] rounded-sm border px-3.5 text-[14px] font-semibold transition-colors ${
      on
        ? "border-accent bg-accent text-on-accent"
        : "border-line bg-surface text-ink hover:border-ink"
    }`;

  return (
    <div className="flex flex-col gap-5">
      {!sinFecha ? (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink">¿qué día?</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onFecha(null);
                setOtroDiaOpen(false);
              }}
              aria-pressed={fecha === null}
              className={CHIP(fecha === null)}
            >
              hoy
            </button>
            <button
              type="button"
              onClick={() => {
                onFecha(keyManana);
                setOtroDiaOpen(false);
              }}
              aria-pressed={fecha === keyManana && fecha !== null}
              className={CHIP(fecha !== null && fecha === keyManana)}
            >
              mañana
            </button>
            <button
              type="button"
              onClick={() => setOtroDiaOpen((o) => !o)}
              aria-expanded={otroDiaOpen}
              className={CHIP(esOtroDia)}
            >
              {esOtroDia ? fechaLegible(fecha!).replace(/^el /, "") : "otro día…"}
            </button>
          </div>
          {otroDiaOpen ? (
            <CalendarioDias
              fecha={fecha}
              onPick={(k) => {
                onFecha(k);
                setOtroDiaOpen(false);
              }}
            />
          ) : null}
        </div>
      ) : null}

      {/* Día o noche */}
      <StepMomento momento={momento} onPick={onMomento} />

      {/* ¿DÓNDE? — pregunta explícita, con "aquí" como default. Tocar "aquí"
          pide la ubicación en ese tap; "en otra ciudad" abre el geocoder (la
          pieza del modo Viaje) — así el clima del siguiente paso llega como
          CONCLUSIÓN ("en Cuernavaca va a llover"), no como cuestionario. */}
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink">¿dónde?</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onAqui}
            aria-pressed={donde === "aqui"}
            className={`flex min-h-[52px] flex-col items-start justify-center rounded-sm border px-3.5 py-2 text-left transition-colors ${
              donde === "aqui"
                ? "border-accent bg-accent text-on-accent"
                : "border-line bg-surface text-ink hover:border-ink"
            }`}
          >
            {/* "en esta ciudad", NO "aquí, donde estoy": con la segunda la
                gente pensaba en el punto exacto donde está parada y dudaba de
                compartirlo. Para el clima basta la ciudad y eso es lo que la
                etiqueta debe prometer. */}
            <span className="text-[14px] font-semibold">en esta ciudad</span>
            <span className={`text-[12px] ${donde === "aqui" ? "opacity-80" : "text-muted"}`}>
              {aquiEstado === "listo"
                ? "listo — ya sé dónde"
                : aquiEstado === "leyendo"
                  ? "leyendo tu ubicación…"
                  : "tu ubicación de referencia"}
            </span>
          </button>
          <button
            type="button"
            onClick={onOtra}
            aria-pressed={donde === "otra"}
            className={`flex min-h-[52px] flex-col items-start justify-center rounded-sm border px-3.5 py-2 text-left transition-colors ${
              donde === "otra"
                ? "border-accent bg-accent text-on-accent"
                : "border-line bg-surface text-ink hover:border-ink"
            }`}
          >
            <span className="text-[14px] font-semibold">en otra ciudad</span>
            <span className={`text-[12px] ${donde === "otra" ? "opacity-80" : "text-muted"}`}>
              dime cuál y saco el clima
            </span>
          </button>
        </div>

        {/* PRIMERA VEZ: se explica antes de pedir. El prompt del navegador sale
            una sola vez y un "no permitir" no se puede volver a preguntar —
            gastarlo sin decir para qué es la forma más cara de perderlo. */}
        {donde === "aqui" && aquiEstado === "pedir" ? (
          <div
            className="flex flex-col gap-2"
            style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
          >
            <button
              type="button"
              onClick={onPedirUbicacion}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
            >
              <Icon name="ubicacion" size={17} /> compartir mi ubicación
            </button>
            <span className="text-center text-[12px] leading-snug text-muted">
              te lo pide el navegador solo una vez — no importa el punto exacto,
              la uso de referencia para el clima
            </span>
          </div>
        ) : null}

        {donde === "aqui" && aquiEstado === "bloqueado" ? (
          <span className="text-[12px] text-muted">
            tu navegador tiene la ubicación bloqueada para stailist — actívala
            en sus ajustes, o al final me dices tú el clima
          </span>
        ) : donde === "aqui" && aquiEstado === "fallo" ? (
          <span className="text-[12px] text-muted">
            no pude leer tu ubicación — el clima te lo pregunto en el siguiente paso
          </span>
        ) : null}

        {donde === "otra" ? (
          ciudadGeo ? (
            <div className="flex items-center gap-2.5 rounded-sm border border-ink bg-surface px-3.5 py-2.5">
              <Icon name="ubicacion" size={16} className="shrink-0 text-ink" />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
                en {ciudadGeo.label}
              </span>
              <button
                type="button"
                onClick={onQuitarCiudad}
                aria-label="Quitar la ciudad"
                className="shrink-0 text-[13px] font-semibold text-muted hover:text-ink"
              >
                quitar
              </button>
            </div>
          ) : (
            <div
              className="flex flex-col gap-1.5"
              style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
            >
              <label className="flex items-center gap-2.5 border border-line bg-surface px-3.5 py-2.5 transition-colors focus-within:border-ink">
                <Icon name="ubicacion" size={16} className="shrink-0 text-muted" />
                <input
                  value={ciudadTexto}
                  onChange={(e) => onCiudadTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onBuscarCiudad();
                  }}
                  maxLength={60}
                  placeholder="¿en qué ciudad es el plan?"
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-ink caret-accent outline-none placeholder:text-muted"
                />
                <button
                  type="button"
                  onClick={onBuscarCiudad}
                  disabled={ciudadBuscando || !ciudadTexto.trim()}
                  className="shrink-0 text-[13px] font-bold text-ink disabled:opacity-40"
                >
                  {ciudadBuscando ? <Spinner className="h-4 w-4" /> : "buscar"}
                </button>
              </label>
              {ciudadFallo ? (
                <span className="text-[12px] text-error">
                  no encontré esa ciudad — inténtalo con el nombre completo
                </span>
              ) : null}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

// El calendario de "otro día": rejilla de mes REAL (Roberto: "que se vea un
// calendario así grande para que le piques y se cierra... pero no así [la
// sábana de chips], se ve horrible"). Solo los días dentro del horizonte del
// pronóstico se pueden tocar; el resto se ve, apagado, para que el mes se lea
// como mes.
function CalendarioDias({
  fecha,
  onPick,
}: {
  fecha: string | null;
  onPick: (k: string | null) => void;
}) {
  const hoy = new Date();
  const min = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const max = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + DIAS_PLANEABLES);
  const keyHoy = fmtFechaLocal(min);

  // Los meses que el rango toca (1 o 2).
  const meses: Date[] = [];
  for (
    let m = new Date(min.getFullYear(), min.getMonth(), 1);
    m <= max;
    m = new Date(m.getFullYear(), m.getMonth() + 1, 1)
  ) {
    meses.push(m);
  }

  return (
    <div
      className="flex flex-col gap-4 border border-line bg-surface p-3.5"
      style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
    >
      {meses.map((mes) => {
        const nombreMes = mes.toLocaleDateString("es-MX", { month: "long" });
        const diasEnMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
        // getDay(): 0 = domingo. El encabezado arranca en domingo (D L M M J V S).
        const offset = new Date(mes.getFullYear(), mes.getMonth(), 1).getDay();
        return (
          <div key={nombreMes} className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">
              {nombreMes}
            </span>
            <div className="grid grid-cols-7 gap-y-0.5 text-center">
              {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
                <span key={`${d}${i}`} className="text-[11px] font-bold text-faint">
                  {d}
                </span>
              ))}
              {Array.from({ length: offset }).map((_, i) => (
                <span key={`v${i}`} />
              ))}
              {Array.from({ length: diasEnMes }).map((_, i) => {
                const d = new Date(mes.getFullYear(), mes.getMonth(), i + 1);
                const key = fmtFechaLocal(d);
                const dentro = d >= min && d <= max;
                const on = fecha === key || (!fecha && key === keyHoy);
                if (!dentro) {
                  return (
                    <span
                      key={key}
                      className="flex h-10 items-center justify-center text-[14px] text-faint"
                    >
                      {i + 1}
                    </span>
                  );
                }
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onPick(key === keyHoy ? null : key)}
                    aria-pressed={on}
                    className={`mx-auto flex h-10 w-10 items-center justify-center rounded-sm text-[14px] font-semibold transition-colors ${
                      on
                        ? "bg-accent text-on-accent"
                        : "text-ink hover:bg-tile"
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepMomento({
  momento,
  onPick,
}: {
  momento: "dia" | "noche";
  onPick: (m: "dia" | "noche") => void;
}) {
  const cards: { key: "dia" | "noche"; icon: IconName; title: string; sub: string }[] = [
    { key: "dia", icon: "sol", title: "de día", sub: "junta, lunch, oficina" },
    { key: "noche", icon: "luna", title: "de noche", sub: "cena, drinks, salida" },
  ];
  return (
    <div className="flex flex-col gap-3">
      {cards.map((c) => {
        const on = momento === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onPick(c.key)}
            aria-pressed={on}
            className={`flex items-center gap-4 border bg-surface px-5 py-[22px] text-left transition-colors ${
              on ? ON : "border-line hover:border-ink"
            }`}
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center border transition-colors ${
                on ? ICON_ON : "border-line bg-bg text-ink"
              }`}
            >
              <Icon name={c.icon} size={22} />
            </span>
            <span className="flex flex-col">
              <b className="text-[20px] font-semibold text-ink">{c.title}</b>
              <span className="text-[16px] text-muted">{c.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StepClima({
  idx,
  rain,
  onIdx,
  onRain,
  paraguas,
  onParaguas,
  techado,
  onTechado,
  fechaLabel = null,
  climaAuto = null,
  resolviendo = false,
  ciudadLabel = null,
  onCompartir,
  puedeCompartir,
  aquiEstado,
}: {
  /** null = nadie ha elegido todavía. Ver el comentario de `climaIdx`. */
  idx: number | null;
  rain: boolean;
  /** "el sábado 16" cuando el look es para otro día. */
  fechaLabel?: string | null;
  /** El clima ya PRE-RESUELTO (del "¿dónde?" del paso anterior): el paso es la
   *  CONCLUSIÓN — "en Cuernavaca va a llover" — y las bandas viven detrás de
   *  "corrígeme". Preguntar lo que la app ya sabe delataba a la máquina. */
  climaAuto?: Weather | null;
  resolviendo?: boolean;
  /** "Irapuato, Guanajuato" si el plan es en otra ciudad. */
  ciudadLabel?: string | null;
  /** Compartir ubicación AQUÍ (el camino principal cuando aún no hay coords):
   *  resuelve el clima y lo muestra como conclusión, sin salir del paso. */
  onCompartir: () => void;
  /** false cuando dijo "en otra ciudad" (ahí compartir ubicación no aplica). */
  puedeCompartir: boolean;
  /** Cómo quedó el permiso: bloqueado/fallo abren el cuestionario, con su
   *  explicación — el "no pude leer tu ubicación" sin porqué era lo raro. */
  aquiEstado: "idle" | "pedir" | "leyendo" | "listo" | "bloqueado" | "fallo";
  onIdx: (i: number) => void;
  onRain: (r: boolean) => void;
  paraguas: boolean;
  onParaguas: (p: boolean) => void;
  /** "¿la lluvia te toca?" → true = bajo techo, la lluvia no manda el look. */
  techado: boolean;
  onTechado: (t: boolean) => void;
}) {
  // El listado manual solo se abre si la persona lo pide ("prefiero decirte
  // yo") o si la ubicación falló — la decisión de Roberto: empujar a compartir
  // ubicación, con la salida explícita a la vista, no dos caminos iguales.
  const sinUbicacion = aquiEstado === "bloqueado" || aquiEstado === "fallo";
  const [manualAbierto, setManualAbierto] = useState(!puedeCompartir || sinUbicacion);
  useEffect(() => {
    if (sinUbicacion) setManualAbierto(true);
  }, [sinUbicacion]);

  // Las bandas + la lluvia manual: el cuestionario completo. Camino primario
  // solo sin coords; letra chica ("corrígeme") cuando el clima llegó resuelto.
  const cuestionario = (
    <>
      <div className="flex flex-col">
        {BUCKETS.map((b, i) => {
          const on = i === idx;
          return (
            <button
              key={b.label}
              type="button"
              onClick={() => onIdx(i)}
              aria-pressed={on}
              className={`-mt-px flex items-center gap-3.5 border p-3.5 text-left transition-colors ${
                on
                  ? "relative z-[2] border-ink shadow-[inset_0_0_0_1px_var(--c-ink)]"
                  : "border-line hover:border-ink"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full border transition-colors ${
                  on ? "border-ink bg-ink" : "border-muted"
                }`}
              />
              <span className="w-[84px] shrink-0 text-[16px] font-semibold text-ink">
                {b.label}
              </span>
              <span className="text-[16px] text-muted">{b.ref}</span>
              <span className="tabular ml-auto text-[14px] font-bold text-ink">
                {b.temp_c}°
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-[18px] mb-1 flex items-center gap-3">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <Icon name="lluvia" size={17} className="text-muted" /> ¿va a llover?
        </span>
        <div className="ml-auto inline-flex overflow-hidden rounded-sm border border-line">
          <button
            type="button"
            onClick={() => onRain(false)}
            aria-pressed={!rain}
            className={`min-h-[38px] px-5 text-[14px] font-semibold transition-colors ${
              !rain ? "bg-accent text-on-accent" : "bg-surface text-ink"
            }`}
          >
            no
          </button>
          <button
            type="button"
            onClick={() => onRain(true)}
            aria-pressed={rain}
            className={`min-h-[38px] border-l border-line px-5 text-[14px] font-semibold transition-colors ${
              rain ? "bg-accent text-on-accent" : "bg-surface text-ink"
            }`}
          >
            sí
          </button>
        </div>
      </div>
    </>
  );

  // "¿LA LLUVIA TE TOCA?" — antes que el paraguas, porque puede borrarlo.
  //
  // Roberto: "puede estar lloviendo y si yo voy a estar siempre entechado, me
  // la pela la lluvia". Es cierto y era un agujero: la app trataba cualquier
  // día de lluvia como un día a la intemperie, así que una comida en un salón
  // techado perdía los mocasines y ganaba una gabardina que nadie iba a usar.
  //
  // Bajo techo NO se le avisa al motor que llueve (el server le quita el dato,
  // ver climaParaElMotor): solo queda la temperatura, que sí importa igual.
  const filaTecho = rain ? (
    <div
      className="mt-4 flex flex-col gap-2.5"
      style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
    >
      <span className="flex items-center gap-2">
        <Icon name="techo" size={17} className="shrink-0 text-muted" />
        <span className="flex flex-col">
          <span className="text-[14px] font-semibold text-ink">
            ¿la lluvia te toca?
          </span>
          <span className="text-[13px] text-muted">
            {techado
              ? "bajo techo, la lluvia no manda el look"
              : "dime si andarás afuera o todo bajo techo"}
          </span>
        </span>
      </span>
      <div className="grid grid-cols-2 overflow-hidden rounded-sm border border-line">
        <button
          type="button"
          onClick={() => onTechado(false)}
          aria-pressed={!techado}
          className={`min-h-[44px] text-[14px] font-semibold transition-colors ${
            !techado ? "bg-accent text-on-accent" : "bg-surface text-ink"
          }`}
        >
          afuera
        </button>
        <button
          type="button"
          onClick={() => onTechado(true)}
          aria-pressed={techado}
          className={`min-h-[44px] border-l border-line text-[14px] font-semibold transition-colors ${
            techado ? "bg-accent text-on-accent" : "bg-surface text-ink"
          }`}
        >
          techado
        </button>
      </div>
    </div>
  ) : null;

  // El paraguas, solo si llueve Y le toca la lluvia — bajo techo la pregunta no
  // significa nada. Su porqué de verdad: decide si la capa de arriba tiene que
  // repeler agua o se elige por estilo (el calzado firme va igual). "Te suelto
  // la mano" no lo entendía nadie.
  const filaParaguas = rain && !techado ? (
    <div
      className="mt-3 flex items-center gap-3"
      style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
    >
      <span className="flex flex-col">
        <span className="text-[14px] font-semibold text-ink">
          ¿llevas paraguas?
        </span>
        <span className="text-[13px] text-muted">
          decide si tu capa de arriba tiene que aguantar agua
        </span>
      </span>
      <div className="ml-auto inline-flex shrink-0 overflow-hidden rounded-sm border border-line">
        <button
          type="button"
          onClick={() => onParaguas(false)}
          aria-pressed={!paraguas}
          className={`min-h-[38px] px-5 text-[14px] font-semibold transition-colors ${
            !paraguas ? "bg-accent text-on-accent" : "bg-surface text-ink"
          }`}
        >
          no
        </button>
        <button
          type="button"
          onClick={() => onParaguas(true)}
          aria-pressed={paraguas}
          className={`min-h-[38px] border-l border-line px-5 text-[14px] font-semibold transition-colors ${
            paraguas ? "bg-accent text-on-accent" : "bg-surface text-ink"
          }`}
        >
          sí
        </button>
      </div>
    </div>
  ) : null;

  if (resolviendo) {
    return (
      <div className="flex items-center gap-3 border border-line bg-surface p-3.5">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          <Spinner className="h-4 w-4" />
        </span>
        <span className="text-[15px] font-semibold text-ink">
          {fechaLabel ? "leyendo el pronóstico…" : "leyendo el clima…"}
        </span>
      </div>
    );
  }

  if (climaAuto) {
    // LA CONCLUSIÓN — con su FUENTE a la vista: sin ella "20°" se leía como
    // adivinanza (Roberto). El histórico se explica, no se disfraza.
    const fuente = climaAuto.estimated
      ? "no hay pronóstico tan lejos — es el clima típico de estas fechas"
      : "pronóstico de Open-Meteo";
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border border-ink bg-surface p-4">
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
            <Icon name={hayLluvia(climaAuto.condition) ? "lluvia" : "sol"} size={18} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[17px] font-bold text-ink">
              {climaAuto.temp_c}° · {climaAuto.condition}
            </span>
            <span className="text-[14px] text-muted">
              {fechaLabel ? `así se ve ${fechaLabel}` : "así está ahorita"}
              {ciudadLabel ? ` en ${ciudadLabel.split(",")[0]}` : ""}
            </span>
            <span className="text-[12px] text-faint">{fuente}</span>
          </span>
        </div>

        {filaTecho}
        {filaParaguas}

        <details className="mt-4">
          <summary className="cursor-pointer text-[13px] font-semibold text-muted hover:text-ink">
            ¿no va? corrígeme
          </summary>
          <div className="mt-3">{cuestionario}</div>
        </details>
      </div>
    );
  }

  // Sin clima resuelto. El camino principal es COMPARTIR ubicación; el listado
  // manual es la salida explícita — no dos opciones del mismo peso.
  return (
    <div className="flex flex-col">
      {puedeCompartir && !manualAbierto ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onCompartir}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
          >
            <Icon name="ubicacion" size={17} /> compartir mi ubicación
          </button>
          <span className="text-center text-[13px] text-muted">
            {fechaLabel
              ? `leo el pronóstico ${fechaLabel.startsWith("el ") ? "del " + fechaLabel.slice(3) : "de " + fechaLabel} y te lo muestro aquí`
              : "leo tu clima y te lo muestro aquí"}
          </span>
          <button
            type="button"
            onClick={() => setManualAbierto(true)}
            className="min-h-[44px] text-[13px] font-semibold text-muted transition-colors hover:text-ink"
          >
            prefiero decirte yo
          </button>
        </div>
      ) : (
        <>
          {aquiEstado === "bloqueado" ? (
            <span className="mb-3 text-[13px] text-muted">
              tu navegador tiene la ubicación bloqueada para stailist (un "no
              permitir" de antes) — actívala en los ajustes del navegador, o
              dime tú:
            </span>
          ) : aquiEstado === "fallo" ? (
            <span className="mb-3 text-[13px] text-muted">
              no pude leer tu ubicación — dime tú:
            </span>
          ) : null}
          {cuestionario}
          {filaTecho}
          {filaParaguas}
        </>
      )}
    </div>
  );
}

// Disparador del ancla (paso 1): fila opcional que muestra la prenda elegida o
// invita a abrir la hoja. Vive con la ocasión (intención), no con el clima.
function AnchorTrigger({
  selected,
  onOpen,
  onClear,
}: {
  selected: ClosetPick | null;
  onOpen: () => void;
  onClear: () => void;
}) {
  return (
    <div className="border-t border-line pt-4">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
        opcional
      </p>
      {selected ? (
        <div className="flex items-center gap-3 border border-ink bg-surface p-2.5">
          <span className="flex h-[44px] w-[36px] shrink-0 items-center justify-center overflow-hidden rounded-sm border border-line bg-tile">
            {selected.imagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.imagen}
                alt={selected.nombre}
                className="h-full w-full object-cover"
              />
            ) : (
              <span
                className="block h-full w-full"
                style={{ backgroundColor: selected.swatch }}
              />
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              vas a usar
            </span>
            <span className="truncate text-[15px] font-semibold text-ink">
              {selected.nombre}
            </span>
          </span>
          <button
            type="button"
            onClick={onOpen}
            className="ml-auto shrink-0 text-[13px] font-semibold text-ink underline underline-offset-2"
          >
            cambiar
          </button>
          <button
            type="button"
            onClick={onClear}
            aria-label="Quitar prenda"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center border border-line text-muted transition-colors hover:border-ink hover:text-ink"
          >
            <Icon name="equis" size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-center gap-3 border border-line bg-surface p-3.5 text-left transition-colors hover:border-ink"
        >
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center border border-line bg-bg text-ink">
            <Icon name="gancho" size={18} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-semibold text-ink">
              ¿algo que te quieras poner?
            </span>
            <span className="text-[15px] text-muted">
              lo armo alrededor de esa prenda
            </span>
          </span>
          <Icon name="chevron" size={17} className="ml-auto shrink-0 text-muted" />
        </button>
      )}
    </div>
  );
}

// Hoja del picker: chips de categoría + búsqueda + grid vertical 2-col. Escala a
// clósets grandes (vs. el scroll lateral infinito). Tocar una prenda la elige y
// cierra; tocar la elegida la quita.
function AnchorSheet({
  closet,
  selected,
  onSelect,
  onClose,
}: {
  closet: ClosetPick[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const cats = CAT_ORDER.filter((c) => closet.some((i) => i.category === c));
  const [cat, setCat] = useState<string>("todos");
  const [q, setQ] = useState("");
  const query = norm(q.trim());
  const filtered = closet.filter(
    (c) =>
      (cat === "todos" || c.category === cat) &&
      (query === "" || norm(c.nombre).includes(query))
  );
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end lg:items-center lg:justify-center bg-[rgb(10_10_10/0.45)]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Elegir una prenda"
    >
      <div
        className="flex max-h-[88dvh] flex-col rounded-t-[16px] bg-bg lg:w-full lg:max-w-[430px] lg:rounded-[16px]"
        style={{ animation: "var(--dur-medium) var(--ease-enter) sheet-up" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-none px-[18px] pt-3">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" />
          <div className="flex items-center gap-3">
            <h2 className="text-[18px] font-bold tracking-[-0.02em] text-ink">
              ¿algo que te quieras poner?
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="ml-auto flex h-[34px] w-[34px] shrink-0 items-center justify-center border border-line text-ink transition-colors hover:border-ink"
            >
              <Icon name="equis" size={16} />
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2.5 border border-line bg-surface px-3.5 py-2.5 transition-colors focus-within:border-ink">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="busca una prenda"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-ink caret-accent outline-none placeholder:text-muted"
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Limpiar búsqueda"
                className="shrink-0 text-muted hover:text-ink"
              >
                <Icon name="equis" size={14} />
              </button>
            ) : null}
          </label>
          <div className="-mx-[18px] mt-3 flex gap-2 overflow-x-auto px-[18px] pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {["todos", ...cats].map((c) => {
              const on = c === cat;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(c)}
                  aria-pressed={on}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    on
                      ? "border-accent bg-accent text-on-accent"
                      : "border-line bg-surface text-ink hover:border-ink"
                  }`}
                >
                  {c === "todos" ? "Todos" : (CAT_LABELS[c] ?? c)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-muted">
              nada por aquí — prueba otra categoría o búsqueda.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((c) => {
                const on = c.id === selected;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelect(on ? null : c.id)}
                    aria-pressed={on}
                    className={`relative aspect-[3/4] overflow-hidden rounded-md border text-left transition-colors ${
                      on ? "border-ink shadow-[inset_0_0_0_1px_var(--c-ink)]" : "border-line"
                    }`}
                  >
                    {c.imagen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.imagen}
                        alt={c.nombre}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span
                        className="block h-full w-full"
                        style={{ backgroundColor: c.swatch }}
                      />
                    )}
                    <span
                      className={`absolute right-2 top-2 flex h-[25px] w-[25px] items-center justify-center rounded-full border transition-colors ${
                        on
                          ? "border-accent bg-accent text-on-accent"
                          : "border-line bg-surface/85 text-transparent"
                      }`}
                    >
                      <Icon name="check" size={14} strokeWidth={2.6} />
                    </span>
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface/95 via-surface/80 to-transparent px-2.5 pb-2 pt-6 text-[11px] font-semibold text-ink">
                      {c.nombre}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
