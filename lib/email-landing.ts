// El correo que se tecleó en la landing, de camino al login.
//
// Antes viajaba en la URL (/login?email=…). Con las etiquetas de publicidad
// cargadas en la landing (lib/publicidad.ts), esa URL entraba al historial que
// Google y TikTok observan. Ahora viaja en sessionStorage: se queda en esta
// pestaña, el login lo lee una vez y lo borra.
export const EMAIL_LANDING_KEY = "st_email_landing";
