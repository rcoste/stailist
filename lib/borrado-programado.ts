// EL BORRADO PROGRAMADO DE LA CUENTA.
//
// POR QUÉ EXISTE
// Roberto, 2026-09-10: borrar la cuenta era instantáneo, y un tap impulsivo
// costaba un clóset entero. Él quería volver difícil pedir el borrado; eso no
// se puede (los derechos ARCO tienen que poder ejercerse de forma simple), así
// que la fricción legítima es TIEMPO: la cuenta se desactiva el día que se pide
// y se borra por completo DIAS_PARA_BORRAR días después. Si la persona entra
// antes, elige recuperarla.
//
// POR QUÉ 30 Y NO 90: es lo que usan Instagram, TikTok y Google, y durante ese
// plazo los datos no se pueden usar para nada (sólo esperan). Más días es más
// tiempo guardando algo inútil y más exposición. Cambiar este número cambia el
// aviso de privacidad, los términos y el botón (todos lo importan).
//
// QUIÉN HACE QUÉ
// - app/perfil/actions.ts (borrarMiCuenta): programa, avisa por correo, cierra
//   la sesión.
// - lib/auth.ts (getProfile) y app/page.tsx: una cuenta programada no abre
//   ninguna pantalla; va a RUTA_CUENTA_PROGRAMADA.
// - app/cuenta/programada: recuperar o seguir con el borrado.
// - app/api/cron/limpieza: al vencer, borra archivos, filas y usuario de auth.
// - Los crons de correo (semanal, reenganche) la saltan.

export const DIAS_PARA_BORRAR = 30;

export const RUTA_CUENTA_PROGRAMADA = "/cuenta/programada";

/**
 * ¿Ya pasó el plazo? A partir de ahí la cuenta NO se recupera: la limpieza
 * diaria puede haber borrado los archivos y no las filas todavía.
 *
 * Riesgo aceptado (revisión del 2026-09-10): las rutas de /api no pasan por
 * getProfile, así que alguien con el borrado programado que vuelve a entrar
 * podría llamarlas a mano. La app no le muestra nada de eso (toda pantalla la
 * manda a RUTA_CUENTA_PROGRAMADA) y serían sus propios datos a petición suya.
 */
export function yaVencio(para: Date, ahora: Date = new Date()): boolean {
  return para.getTime() <= ahora.getTime();
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Cuándo se borra una cuenta si se pide en `ahora`. */
export function fechaDeBorrado(ahora: Date): Date {
  return new Date(ahora.getTime() + DIAS_PARA_BORRAR * DIA_MS);
}

/** "10 de octubre de 2026", en hora de la Ciudad de México. */
export function fechaLegible(fecha: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

/** ¿La cuenta está en su periodo de borrado programado? */
export function estaProgramada(perfil: { borrado_programado_para?: string | null } | null | undefined): boolean {
  return !!perfil?.borrado_programado_para;
}
