// Candado de scroll del body, COMPARTIDO y con conteo de referencias.
//
// El bug que motiva esto (2026-07-26, biblioteca sin scroll): había 8 overlays
// haciendo cada uno `prev = body.style.overflow; body = "hidden"; … body = prev`.
// Si dos se traslapan en el tiempo (drawer "más" → hoja "añadir" → navegar), el
// segundo guarda "hidden" como su `prev` y al cerrarse lo RESTAURA → el body
// queda trabado para siempre (hasta recargar). Con conteo de referencias, el
// scroll vuelve exactamente cuando el ÚLTIMO candado se suelta.
//
// Uso en efectos:
//   useEffect(() => { lockBodyScroll(); return unlockBodyScroll; }, [deps]);
let locks = 0;

export function lockBodyScroll() {
  locks++;
  document.body.style.overflow = "hidden";
}

export function unlockBodyScroll() {
  locks = Math.max(0, locks - 1);
  if (locks === 0) document.body.style.overflow = "";
}
