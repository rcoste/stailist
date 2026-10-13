// EL MENSAJE DEL FRENO, LEÍDO EN EL CLIENTE.
//
// Toda ruta de IA que frena (cuota del día, tope de dinero, pausa manual, sesión
// sin correo) contesta igual: 429 con `{ error: "cuota", motivo, mensaje }`, y
// el `mensaje` ya viene redactado para la persona ("ya te armé 20 looks hoy.
// mañana seguimos"). Lo que fallaba era del lado de acá: la mitad de las
// pantallas trataban ese 429 como un error cualquiera y decían "no pude" o
// "inténtalo de nuevo" —que es mentira dos veces: sí pudo, y reintentar no va a
// servir hasta mañana. Roberto, 2026-10-13: "frenos sí, pero con mensajes con
// contexto, no que nada más deje de hacer algo la app".
//
// Un solo helper para que ninguna pantalla vuelva a tener que saber la forma
// del cuerpo. Devuelve el mensaje del servidor si la respuesta es un freno, y
// null si es cualquier otra cosa (ahí cada pantalla pone su texto de siempre).

/** El cuerpo que mandan las rutas de IA al frenar. */
export type CuerpoFreno = { error?: unknown; motivo?: unknown; mensaje?: unknown };

export function mensajeDelFreno(status: number, cuerpo: unknown): string | null {
  if (status !== 429 || !cuerpo || typeof cuerpo !== "object") return null;
  const c = cuerpo as CuerpoFreno;
  return typeof c.mensaje === "string" && c.mensaje.trim() ? c.mensaje : null;
}

/** ¿Es un freno (y no un fallo)? Para decidir si ofrecer "reintentar". */
export function esFreno(status: number, cuerpo: unknown): boolean {
  return mensajeDelFreno(status, cuerpo) !== null;
}
