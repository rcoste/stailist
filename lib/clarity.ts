// MICROSOFT CLARITY — grabación anónima de cómo se usa la app. APAGADA SIN SU ID.
//
// POR QUÉ EXISTE (2026-10-30)
// El 62% no hace nada después del primer look y no sabemos qué INTENTA hacer
// antes de irse. Roberto ya usa Clarity en otros proyectos y le sirve justo
// para eso: ver qué NO hacen. Aquí la diferencia es que la app está llena de
// fotos de la ropa de la gente, su avatar y su cara en el probador, así que la
// grabación entra sin una sola foto o no entra.
//
// LAS CUATRO REGLAS, Y DÓNDE VIVE CADA UNA
// 1. Ni una foto: conFotosTapadas (abajo) le agrega las fotos a la lista de
//    cosas a tapar en el momento en que Clarity arranca, así que la protección
//    vive en este código y no en un ajuste del panel. Decisión de Roberto del
//    2026-11-02: el texto SÍ se ve, porque sin leer la pantalla la grabación no
//    contesta qué no hace la gente. El panel va en Equilibrado, que sigue
//    tapando números, correos y lo que se teclea.
//    OJO, leído en el clarity.js real (0.8.73-beta): su enmascarado limpia
//    src, srcset, title, alt y href, y NADA MÁS. Por eso una foto pintada como
//    fondo CSS le entrega su enlace firmado: en la app, las fotos van siempre
//    en <img> (lo blinda un test). Lo mismo pasa con `priority` de next/image,
//    que escribe el enlace en un <link rel="preload">: sólo para imágenes
//    públicas. Y data-clarity-unmask destapa también las <img> hijas: nunca
//    ponerlo en algo que pueda contener una foto.
// 2. Las pantallas del cuerpo van tapadas enteras, texto incluido, con
//    data-clarity-mask: silueta, avatar y espejo.
// 3. No carga donde no se sabe la edad ni donde no hay cuenta: landing, login,
//    los dos primeros pasos del onboarding (género y edad), lo legal, el admin
//    y los looks compartidos (/v, los ve gente sin cuenta). Ver rutaConClarity.
// 4. Respeta lo mismo que las etiquetas de publicidad: el interruptor de
//    /privacidad, la señal Global Privacy Control y la cookie de menor de edad
//    (permitidoEnEsteNavegador, lib/publicidad.ts). Con cualquiera de las tres,
//    no carga; y si estaba cargada, una recarga la suelta.
//
// EL SWITCH: NEXT_PUBLIC_CLARITY_ID (el id del proyecto en clarity.microsoft.com,
// 8-12 letras y números). Sin él no se inyecta nada. Con él, redeploy.

export const FORMATO_ID = /^[a-z0-9]{6,20}$/;

/** El id del proyecto, validado. Un valor con typo se descarta en vez de
 *  interpolarse en la URL del script. */
export function clarityId(raw: string | undefined = process.env.NEXT_PUBLIC_CLARITY_ID): string | null {
  const v = (raw ?? "").trim();
  return FORMATO_ID.test(v) ? v : null;
}

/** Dónde NO se graba. Todo lo demás de la app sí (clóset, hoy, perfil, viaje…). */
const SIN_CLARITY: ReadonlyArray<RegExp> = [
  /^\/$/, // landing: todavía no hay cuenta ni edad
  /^\/login(?:\/|$)/,
  /^\/empezar(?:\/|$)/,
  /^\/onboarding\/(?:genero|edad)(?:\/|$)/, // antes de saber la edad
  /^\/privacidad(?:\/|$)/,
  /^\/terminos(?:\/|$)/,
  /^\/admin(?:\/|$)/,
  /^\/v\//, // looks compartidos: los abre gente sin cuenta
  /^\/cuenta(?:\/|$)/, // borrado programado
];

export function rutaConClarity(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return !SIN_CLARITY.some((re) => re.test(pathname));
}

export const URL_SCRIPT = (id: string) => `https://www.clarity.ms/tag/${id}`;

/** Lo que se tapa siempre, venga lo que venga del panel de Clarity. */
export const FOTOS_TAPADAS: readonly string[] = ["img", "video", "source"];

/**
 * El script de Clarity se arranca a sí mismo con `clarity("start", config)`, y
 * esa llamada pasa por NUESTRA cola (components/clarity.tsx) antes de que
 * Clarity cargue. Ahí se agregan las fotos a `mask`: si el panel se queda sin
 * ese ajuste, las fotos siguen tapadas. Conserva lo que traiga el panel.
 */
export function conFotosTapadas(args: unknown[]): unknown[] {
  if (args[0] !== "start" || typeof args[1] !== "object" || args[1] === null) return args;
  const config = args[1] as { mask?: unknown };
  const delPanel = Array.isArray(config.mask) ? (config.mask as string[]) : [];
  return ["start", { ...config, mask: [...new Set([...delPanel, ...FOTOS_TAPADAS])] }, ...args.slice(2)];
}
