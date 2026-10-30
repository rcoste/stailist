// MICROSOFT CLARITY — grabación anónima de cómo se usa la app. APAGADA SIN SU ID.
//
// POR QUÉ EXISTE (2026-10-30)
// El 62% no hace nada después del primer look y no sabemos qué INTENTA hacer
// antes de irse. Roberto ya usa Clarity en otros proyectos y le sirve justo
// para eso: ver qué NO hacen. Aquí la diferencia es que la app está llena de
// fotos de la ropa de la gente, su avatar y su cara en el probador, así que la
// grabación entra con todo tapado o no entra.
//
// LAS TRES REGLAS, Y DÓNDE VIVE CADA UNA
// 1. Nada de imágenes ni textos: el <body> lleva data-clarity-mask="true"
//    (app/layout.tsx), que tapa el árbol ENTERO del lado del navegador antes
//    de mandar nada. Sólo se destapa la barra de pestañas (texto nuestro, fijo)
//    para que la grabación se pueda leer. En el panel de Clarity además se
//    pone "Strict" (cinturón y tirantes; ver docs/designs/avisos-push-y-clarity.md).
// 2. No carga donde no se sabe la edad ni donde no hay cuenta: landing, login,
//    los dos primeros pasos del onboarding (género y edad), lo legal, el admin
//    y los looks compartidos (/v, los ve gente sin cuenta). Ver rutaConClarity.
// 3. Respeta lo mismo que las etiquetas de publicidad: el interruptor de
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
