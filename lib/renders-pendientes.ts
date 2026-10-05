// LAS PRENDAS QUE ENTRARON SIN SU IMAGEN LIMPIA POR EL TOPE DEL DÍA.
//
// Al tocar el tope de renders (lib/cuotas.ts) el alta por foto NO se detiene:
// la prenda entra al clóset, sirve para armar looks desde ese momento, y su
// imagen limpia se genera después, cuando la persona vuelve a su clóset
// (components/closet-grid.tsx).
//
// QUÉ SE VE MIENTRAS TANTO depende de la foto. Si de la foto salió UNA prenda
// (colgada en un gancho, sobre la cama), la foto es una buena miniatura y va en
// `photo_path`. Si salieron VARIAS (una foto de cuerpo entero), ponerla de
// miniatura enseñaría la misma persona cuatro veces como si fueran cuatro
// prendas: ahí la foto se guarda en `attrs.origen_foto` —de donde se dibuja
// después— y la miniatura es el color de la prenda. Se vio en la primera
// prueba real (2026-10-05). Así el gasto en imágenes se hace
// sólo por quien regresa, y nadie se queda con el clóset a medias.
//
// LA MARCA VIVE EN `attrs.render_pendiente`, no en `render_status`, y por una
// razón: el estado "failed" ya significa "se intentó y no salió", y ése NO se
// reintenta solo a propósito (un render que siempre falla sería un bucle de
// costo en cada visita). "Pendiente" es otra cosa: nunca se intentó. La marca
// se quita en cuanto se intenta, salga bien o mal, así que cada prenda se
// intenta una sola vez.

export type PrendaConRender = {
  photo_path?: string | null;
  render_path?: string | null;
  render_status?: string | null;
  attrs?: { render_pendiente?: boolean | null; origen_foto?: string | null } | null;
};

/** ¿Le falta su imagen limpia por el tope, y hay foto de dónde sacarla? */
export function esRenderPendiente(item: PrendaConRender): boolean {
  if (item.attrs?.render_pendiente !== true) return false;
  if (!item.photo_path && !item.attrs?.origen_foto) return false;
  return !(item.render_status === "done" && !!item.render_path);
}

/**
 * Lo que se le dice al terminar de subir, cuando no todas quedaron pulidas.
 * null si todas quedaron: no hay nada que explicar.
 */
export function mensajeDePendientes(guardadas: number, pendientes: number): string | null {
  if (pendientes <= 0 || guardadas <= 0) return null;
  const listas = guardadas - pendientes;
  const prendas = guardadas === 1 ? "tu prenda ya está" : `tus ${guardadas} prendas ya están`;
  const resto = pendientes === 1 ? "la otra la voy puliendo" : "las demás las voy puliendo";
  if (listas <= 0) {
    return `${prendas} en tu clóset y ya sirven para armar looks. hoy ya no alcancé a pulir su imagen: mañana te aviso cuando pueda seguir.`;
  }
  return `${prendas} en tu clóset. dejé ${listas} ${listas === 1 ? "lista" : "listas"} con su imagen limpia; ${resto} y mañana te aviso cuando pueda seguir.`;
}
