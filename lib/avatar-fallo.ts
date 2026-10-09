// QUÉ LE DECIMOS CUANDO EL AVATAR NO SALE.
//
// Nació el 2026-10-08. Una usuaria agotó el tope diario de avatares haciendo
// dos ajustes a su retrato, y de ahí en adelante cada intento chocaba con el
// 429 del tope... pero la pantalla le decía "No pude generar tu avatar" y luego
// "No está saliendo ahorita". Ella reintentó creyendo que era una falla
// pasajera, y además perdió el cuerpo que ya tenía dibujado, porque la pantalla
// sólo ofrecía "reintentar" o "salir".
//
// Ahora cada causa tiene su mensaje y su salida:
//   - límite (429): se dice tal cual y NO se ofrece reintentar, que no serviría.
//   - rechazo: el servicio de imágenes se negó por algo de la foto; volver a
//     mandar las mismas fotos daría lo mismo, así que se ofrece cambiarlas.
//   - dibujo: falla pasajera del servicio; reintentar sí sirve.
//   - red: se cortó la conexión de su lado.
//   - guardar: el avatar ya existe y lo que falló fue subirlo; reintentar
//     guarda otra vez SIN volver a dibujar (antes "reintentar" lo redibujaba,
//     gastando un intento del tope para recuperar algo que ya tenía).
// Y cuando hay un resultado anterior en pantalla, se ofrece quedarse con él.

export type FalloAvatar =
  | { tipo: "limite"; mensaje: string }
  | { tipo: "permiso"; mensaje: string }
  | { tipo: "sesion" }
  | { tipo: "rechazo" }
  | { tipo: "dibujo" }
  | { tipo: "red" }
  | { tipo: "guardar" };

/**
 * Lee la respuesta de /api/avatar/generate que NO salió bien.
 *
 * `cuerpo` es el JSON ya leído (o null si no traía). El 429 lo manda
 * lib/cuotas.ts con su `mensaje` listo para la persona; el 502 trae en
 * `detalle` el motivo de lib/gemini-imagen.ts, que dice "respondió sin imagen"
 * cuando Google se negó a dibujar (filtro de seguridad) en vez de fallar.
 */
export function falloDeRespuesta(status: number, cuerpo: unknown): FalloAvatar {
  const c = (cuerpo && typeof cuerpo === "object" ? cuerpo : {}) as {
    error?: unknown;
    mensaje?: unknown;
    message?: unknown;
    detalle?: unknown;
  };
  if (status === 429) {
    return {
      tipo: "limite",
      mensaje:
        typeof c.mensaje === "string" && c.mensaje
          ? c.mensaje
          : "por hoy ya no puedo rehacer tu avatar — mañana lo afinamos.",
    };
  }
  if (status === 403 && c.error === "permiso_pendiente" && typeof c.message === "string") {
    return { tipo: "permiso", mensaje: c.message };
  }
  if (status === 401) return { tipo: "sesion" };
  if (typeof c.detalle === "string" && c.detalle.includes("sin imagen")) {
    return { tipo: "rechazo" };
  }
  return { tipo: "dibujo" };
}

/** Lo que se pinta: título, explicación y qué botón principal tiene sentido. */
export type TextoFallo = {
  titulo: string;
  detalle: string;
  /** El botón principal: reintentar lo mismo, guardar otra vez, cambiar la foto, o nada. */
  accion: { tipo: "reintentar" | "guardar" | "fotos"; label: string } | null;
};

/** Primera letra en mayúscula: los mensajes de lib/cuotas.ts van en minúscula. */
function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * `intentos`: cuántas veces seguidas falló el dibujo. A la segunda falla
 * pasajera se deja de sugerir "dale otra vez" y se sugiere esperar.
 */
export function textoFallo(f: FalloAvatar, intentos: number): TextoFallo {
  switch (f.tipo) {
    case "limite":
      return {
        titulo: "Llegaste al límite de hoy",
        detalle: capital(f.mensaje),
        accion: null,
      };
    case "permiso":
      return { titulo: "Falta un permiso", detalle: f.mensaje, accion: null };
    case "sesion":
      return {
        titulo: "Se cerró tu sesión",
        detalle: "Vuelve a entrar con tu correo y armamos tu avatar desde las fotos.",
        accion: null,
      };
    case "rechazo":
      return {
        titulo: "No pude dibujarte con esa foto",
        detalle:
          "Algo de la foto frenó el dibujo. Prueba con otra de tu cara: de frente, con buena luz y sin nadie más.",
        accion: { tipo: "fotos", label: "Cambiar la foto" },
      };
    case "red":
      return {
        titulo: "Se cortó la conexión",
        detalle: "Perdí la señal mientras te dibujaba. Revisa tu internet y dale otra vez.",
        accion: { tipo: "reintentar", label: "Intentar otra vez" },
      };
    case "guardar":
      return {
        titulo: "Tu avatar quedó, pero no lo pude guardar",
        detalle: "Dale guardar otra vez: no lo vuelvo a dibujar, sólo lo subo.",
        accion: { tipo: "guardar", label: "Guardar otra vez" },
      };
    case "dibujo":
      return intentos >= 2
        ? {
            titulo: "Sigue sin salir",
            detalle:
              "El servicio que dibuja está fallando ahorita, no es por tus fotos. Inténtalo en un rato.",
            accion: { tipo: "reintentar", label: "Intentar otra vez" },
          }
        : {
            titulo: "No me salió el dibujo",
            detalle:
              "El servicio que dibuja falló esta vez, no es por tus fotos. Dale otra vez.",
            accion: { tipo: "reintentar", label: "Intentar otra vez" },
          };
  }
}
