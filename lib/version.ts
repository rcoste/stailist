// ¿EL JAVASCRIPT QUE ESTÁ CORRIENDO ES VIEJO?
//
// La regla vive aparte de la barra que la muestra porque el precio de
// equivocarse es asimétrico y conviene poder fijarlo con casos:
//
//   avisar de más  → una barra que dice "recarga" cuando no hace falta. Se
//                    recarga, no pasa nada, pero a la tercera vez ya nadie le
//                    cree, y entonces el aviso deja de servir para siempre.
//   avisar de menos → exactamente el día que costó dos investigaciones: un
//                    arreglo desplegado, probado desde un teléfono con el
//                    código anterior, y nadie sospechando del navegador.
//
// Por eso NADA de "ante la duda, avisa": sólo se avisa con dos versiones de
// verdad, distintas entre sí. Un fallo de red, una respuesta rara o una
// versión desconocida no pueden convertirse en "tu app está vieja".
export const VERSION_DESCONOCIDA = "desconocida";

export function hayVersionNueva(
  /** La horneada en ESTE bundle, en tiempo de build. */
  mia: string | undefined | null,
  /** La que el servidor reporta AHORA. */
  delServidor: string | undefined | null
): boolean {
  const a = (mia ?? "").trim();
  const b = (delServidor ?? "").trim();
  if (!a || !b) return false;
  if (a === VERSION_DESCONOCIDA || b === VERSION_DESCONOCIDA) return false;
  return a !== b;
}
